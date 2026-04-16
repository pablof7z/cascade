use anyhow::{anyhow, bail, Context, Result};
use clap::Parser;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;
use tokio::task::JoinSet;

const DEFAULT_AGENT_GLOB: &str = "scripts/agents/*.agent.json";
const DEFAULT_OLLAMA_URL: &str = "http://localhost:11434/api/generate";
const DEFAULT_OLLAMA_MODEL: &str = "glm-5.1:cloud";
const STATE_PATH: &str = "scripts/.cascade-sim-state.json";
const MAX_FEED_ITEMS_PER_AGENT: usize = 16;

#[derive(Debug, Parser)]
#[command(name = "cascade-sim")]
#[command(about = "Run local Cascade simulation agents through the cascade CLI")]
struct Args {
    #[arg(long = "agents", default_value = DEFAULT_AGENT_GLOB, num_args = 1..)]
    agents: Vec<String>,
    #[arg(long)]
    dry_run: bool,
    #[arg(long)]
    once: bool,
    #[arg(long)]
    profiles_only: bool,
    #[arg(long)]
    stress: bool,
    #[arg(long, default_value_t = 0)]
    max_concurrency: usize,
    #[arg(long, default_value_t = 0)]
    loop_delay_ms: u64,
    #[arg(long, default_value = DEFAULT_OLLAMA_URL)]
    ollama_url: String,
    #[arg(long)]
    cascade_bin: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AgentConfig {
    name: String,
    #[serde(default = "default_enabled")]
    enabled: bool,
    #[serde(default = "default_version")]
    version: u64,
    edition: String,
    api_base_url: String,
    #[serde(default)]
    relays: Vec<String>,
    identity: AgentIdentity,
    proof_store: String,
    created_at: String,
    #[serde(default)]
    ollama_model: Option<String>,
    #[serde(default)]
    profile: AgentProfile,
    system_prompt: String,
    #[serde(default)]
    news_feeds: Vec<String>,
    #[serde(default)]
    interests: Vec<String>,
    #[serde(default)]
    risk: AgentRisk,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AgentIdentity {
    nsec: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct AgentProfile {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    about: Option<String>,
    #[serde(default)]
    picture: Option<String>,
    #[serde(default)]
    avatar_url: Option<String>,
    #[serde(default)]
    banner: Option<String>,
    #[serde(default)]
    banner_url: Option<String>,
    #[serde(default)]
    website: Option<String>,
    #[serde(default)]
    nip05: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct ResolvedAgentProfile {
    name: String,
    about: String,
    picture: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    banner_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    website: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    nip05: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AgentRisk {
    #[serde(default = "default_bootstrap_usd_minor")]
    bootstrap_usd_minor: u64,
    #[serde(default = "default_max_trade_minor")]
    max_trade_minor: u64,
    #[serde(default = "default_max_seed_minor")]
    max_seed_minor: u64,
}

impl Default for AgentRisk {
    fn default() -> Self {
        Self {
            bootstrap_usd_minor: default_bootstrap_usd_minor(),
            max_trade_minor: default_max_trade_minor(),
            max_seed_minor: default_max_seed_minor(),
        }
    }
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct SimState {
    #[serde(default)]
    bootstrapped_agents: BTreeSet<String>,
    #[serde(default)]
    profile_signatures: BTreeMap<String, String>,
    #[serde(default)]
    action_counts: BTreeMap<String, u64>,
}

#[derive(Debug, Clone, Serialize)]
struct FeedItem {
    source: String,
    title: String,
    link: Option<String>,
    summary: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OllamaResponse {
    response: String,
}

#[derive(Debug, Clone)]
struct AgentRuntime {
    path: PathBuf,
    config: AgentConfig,
}

#[derive(Debug, Clone)]
struct CascadeRunner {
    repo_root: PathBuf,
    cascade_bin: Option<PathBuf>,
}

#[tokio::main]
async fn main() {
    if let Err(error) = async_main().await {
        eprintln!("{error:#}");
        std::process::exit(1);
    }
}

async fn async_main() -> Result<()> {
    let args = Args::parse();
    let repo_root = find_repo_root()?;
    let agent_paths = expand_agent_args(&repo_root, &args.agents)?;
    if agent_paths.is_empty() {
        bail!("no agent configs found; expected local files such as {DEFAULT_AGENT_GLOB}");
    }

    let mut agents = Vec::new();
    for path in agent_paths {
        let config = read_agent_config(&path)?;
        if config.enabled {
            validate_agent_config(&path, &config)?;
            agents.push(AgentRuntime { path, config });
        }
    }
    if agents.is_empty() {
        bail!("no enabled agent configs found");
    }

    let runner = CascadeRunner {
        repo_root: repo_root.clone(),
        cascade_bin: args.cascade_bin.or_else(|| find_sibling_cascade_binary()),
    };
    let client = Client::builder()
        .timeout(Duration::from_secs(180))
        .build()?;
    let mut state = load_state(&repo_root)?;

    let max_concurrency = if args.max_concurrency > 0 {
        args.max_concurrency
    } else if args.stress {
        8
    } else {
        1
    };
    let loop_delay_ms = if args.loop_delay_ms > 0 {
        args.loop_delay_ms
    } else if args.stress {
        1_000
    } else {
        30_000
    };

    println!(
        "cascade-sim loaded {} enabled agents; stress={}, dry_run={}, once={}, profiles_only={}",
        agents.len(),
        args.stress,
        args.dry_run,
        args.once,
        args.profiles_only
    );

    sync_agent_profiles(&runner, &mut state, &repo_root, &agents, args.dry_run)?;
    if args.profiles_only {
        return Ok(());
    }

    loop {
        bootstrap_agents(&runner, &mut state, &repo_root, &agents, args.dry_run).await?;
        run_agent_pass(
            &runner,
            &client,
            &mut state,
            &repo_root,
            &agents,
            max_concurrency,
            &args.ollama_url,
            args.dry_run,
        )
        .await?;
        if !args.dry_run {
            save_state(&repo_root, &state)?;
        }

        if args.once {
            break;
        }
        tokio::time::sleep(Duration::from_millis(loop_delay_ms)).await;
    }

    Ok(())
}

fn sync_agent_profiles(
    runner: &CascadeRunner,
    state: &mut SimState,
    repo_root: &Path,
    agents: &[AgentRuntime],
    dry_run: bool,
) -> Result<()> {
    for agent in agents {
        let key = agent_key(agent);
        let profile = resolve_agent_profile(agent);
        let signature = profile_signature(&profile)?;
        if state.profile_signatures.get(&key) == Some(&signature) {
            continue;
        }

        println!(
            "{} profile publish name=\"{}\"",
            agent.config.name, profile.name
        );
        if dry_run {
            continue;
        }

        let mut args = vec![
            "profile".to_string(),
            "update".to_string(),
            "--name".to_string(),
            profile.name.clone(),
            "--about".to_string(),
            profile.about.clone(),
            "--avatar-url".to_string(),
            profile.picture.clone(),
        ];
        if let Some(banner_url) = &profile.banner_url {
            args.push("--banner-url".to_string());
            args.push(banner_url.clone());
        }
        if let Some(website) = &profile.website {
            args.push("--website".to_string());
            args.push(website.clone());
        }
        if let Some(nip05) = &profile.nip05 {
            args.push("--nip05".to_string());
            args.push(nip05.clone());
        }

        runner.run_json_owned(&agent.path, args)?;
        state.profile_signatures.insert(key, signature);
        save_state(repo_root, state)?;
    }

    Ok(())
}

async fn bootstrap_agents(
    runner: &CascadeRunner,
    state: &mut SimState,
    repo_root: &Path,
    agents: &[AgentRuntime],
    dry_run: bool,
) -> Result<()> {
    for agent in agents {
        let key = agent_key(agent);
        if state.bootstrapped_agents.contains(&key) {
            continue;
        }
        let portfolio = runner.run_json(&agent.path, &["portfolio", "show"])?;
        let usd_minor = portfolio
            .get("local_usd_minor")
            .and_then(Value::as_u64)
            .unwrap_or_default();
        if usd_minor > 0 {
            if !dry_run {
                state.bootstrapped_agents.insert(key);
            }
            continue;
        }
        let amount = agent.config.risk.bootstrap_usd_minor;
        println!(
            "{} bootstrap faucet amount_minor={amount}",
            agent.config.name
        );
        if dry_run {
            continue;
        }
        runner.run_json(
            &agent.path,
            &["portfolio", "faucet", "--amount-minor", &amount.to_string()],
        )?;
        state.bootstrapped_agents.insert(key);
        save_state(repo_root, state)?;
    }
    Ok(())
}

async fn run_agent_pass(
    runner: &CascadeRunner,
    client: &Client,
    state: &mut SimState,
    repo_root: &Path,
    agents: &[AgentRuntime],
    max_concurrency: usize,
    ollama_url: &str,
    dry_run: bool,
) -> Result<()> {
    for chunk in agents.chunks(max_concurrency.max(1)) {
        let mut tasks = JoinSet::new();
        for agent in chunk.iter().cloned() {
            let runner = runner.clone();
            let client = client.clone();
            let ollama_url = ollama_url.to_string();
            tasks.spawn(async move {
                run_one_agent(&runner, &client, &agent, &ollama_url, dry_run).await
            });
        }

        while let Some(result) = tasks.join_next().await {
            match result {
                Ok(Ok(outcome)) => {
                    println!("{outcome}");
                    if !dry_run {
                        *state.action_counts.entry(outcome).or_default() += 1;
                    }
                }
                Ok(Err(error)) => {
                    eprintln!("agent turn failed: {error:#}");
                }
                Err(error) => {
                    eprintln!("agent task join failed: {error}");
                }
            }
            if !dry_run {
                save_state(repo_root, state)?;
            }
        }
    }
    Ok(())
}

async fn run_one_agent(
    runner: &CascadeRunner,
    client: &Client,
    agent: &AgentRuntime,
    ollama_url: &str,
    dry_run: bool,
) -> Result<String> {
    let context = build_agent_context(runner, client, agent).await?;
    let action = ask_ollama_for_action(client, agent, ollama_url, &context).await?;
    validate_action(agent, &action)?;
    let action_name = action
        .get("action")
        .and_then(Value::as_str)
        .unwrap_or("invalid")
        .to_string();

    if dry_run {
        println!(
            "{} dry-run action: {}",
            agent.config.name,
            serde_json::to_string(&action)?
        );
        return Ok(format!("{}:{action_name}:dry_run", agent.config.name));
    }

    execute_action(runner, agent, &action)
        .with_context(|| format!("{} action {action_name} failed", agent.config.name))?;
    Ok(format!("{}:{action_name}", agent.config.name))
}

async fn build_agent_context(
    runner: &CascadeRunner,
    client: &Client,
    agent: &AgentRuntime,
) -> Result<Value> {
    let portfolio = runner
        .run_json(&agent.path, &["portfolio", "show"])
        .unwrap_or_else(json_error);
    let activity = runner
        .run_json(&agent.path, &["activity", "list", "--limit", "30"])
        .unwrap_or_else(json_error);
    let markets = runner
        .run_json(&agent.path, &["market", "list", "--limit", "30"])
        .unwrap_or_else(json_error);
    let feed = runner
        .run_json(&agent.path, &["feed", "home"])
        .unwrap_or_else(json_error);
    let news = fetch_feed_items(client, &agent.config.news_feeds).await;

    Ok(json!({
        "agent": {
            "name": agent.config.name,
            "interests": agent.config.interests,
            "risk": agent.config.risk,
        },
        "portfolio": portfolio,
        "activity": activity,
        "markets": markets,
        "home_feed": feed,
        "news": news,
    }))
}

async fn ask_ollama_for_action(
    client: &Client,
    agent: &AgentRuntime,
    ollama_url: &str,
    context: &Value,
) -> Result<Value> {
    let system = format!(
        "{}\n\nYou are operating Cascade, a perpetual LONG/SHORT prediction market product. Use only LONG or SHORT side language. Avoid close-step, expiry, external-adjudication, outcome-declaration, or payout-style wording. Describe evidence traders should watch and choose one useful action. Return only JSON.",
        agent.config.system_prompt
    );
    let prompt = format!(
        "Context JSON:\n{}\n\nReturn exactly one JSON object using one of these shapes:\n\
         {{\"action\":\"noop\",\"reason\":\"...\"}}\n\
         {{\"action\":\"create_market\",\"title\":\"...\",\"description\":\"...\",\"slug\":\"...\",\"body\":\"...\",\"seed_side\":\"long|short\",\"seed_spend_minor\":1000,\"categories\":[\"...\"],\"topics\":[\"...\"]}}\n\
         {{\"action\":\"start_discussion\",\"market\":\"slug-or-event-id\",\"title\":\"...\",\"content\":\"...\"}}\n\
         {{\"action\":\"reply_discussion\",\"market\":\"slug-or-event-id\",\"reply\":\"event-id\",\"content\":\"...\"}}\n\
         {{\"action\":\"buy\",\"market\":\"slug-or-event-id\",\"side\":\"long|short\",\"spend_minor\":1000}}\n\
         {{\"action\":\"sell\",\"market\":\"slug-or-event-id\",\"side\":\"long|short\",\"quantity\":1.0}}\n\
         {{\"action\":\"bookmark\",\"market\":\"slug-or-event-id\"}}\n\n\
         Prefer action over noop. Keep market titles precise and perpetual; traders can exit whenever they want.",
        serde_json::to_string(context)?
    );
    let model = agent
        .config
        .ollama_model
        .as_deref()
        .unwrap_or(DEFAULT_OLLAMA_MODEL);
    let payload = json!({
        "model": model,
        "system": system,
        "prompt": prompt,
        "stream": false,
        "format": "json",
        "options": {
            "temperature": 0.7
        }
    });
    let response = client
        .post(ollama_url)
        .json(&payload)
        .send()
        .await
        .with_context(|| format!("failed to call Ollama at {ollama_url}"))?;
    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        bail!("Ollama returned HTTP {status}: {text}");
    }
    let response: OllamaResponse = response.json().await?;
    parse_json_response(&response.response)
}

fn execute_action(runner: &CascadeRunner, agent: &AgentRuntime, action: &Value) -> Result<()> {
    match action_name(action)? {
        "noop" => Ok(()),
        "create_market" => {
            let title = required_str(action, "title")?;
            let description = required_str(action, "description")?;
            let slug = slugify(required_str(action, "slug")?);
            let body = required_str(action, "body")?;
            let side = normalize_side(required_str(action, "seed_side")?)?;
            let seed = required_u64(action, "seed_spend_minor")?;
            let mut args = vec![
                "market".to_string(),
                "create".to_string(),
                "--title".to_string(),
                title.to_string(),
                "--description".to_string(),
                description.to_string(),
                "--slug".to_string(),
                slug,
                "--body".to_string(),
                body.to_string(),
                "--seed-side".to_string(),
                side.to_string(),
                "--seed-spend-minor".to_string(),
                seed.to_string(),
            ];
            for category in string_array(action, "categories") {
                args.push("--category".to_string());
                args.push(category);
            }
            for topic in string_array(action, "topics") {
                args.push("--topic".to_string());
                args.push(topic);
            }
            runner.run_json_owned(&agent.path, args)?;
            Ok(())
        }
        "start_discussion" => {
            runner.run_json(
                &agent.path,
                &[
                    "discussion",
                    "--market",
                    required_str(action, "market")?,
                    "--title",
                    required_str(action, "title")?,
                    "--content",
                    required_str(action, "content")?,
                ],
            )?;
            Ok(())
        }
        "reply_discussion" => {
            runner.run_json(
                &agent.path,
                &[
                    "discussion",
                    "--market",
                    required_str(action, "market")?,
                    "--reply",
                    required_str(action, "reply")?,
                    "--content",
                    required_str(action, "content")?,
                ],
            )?;
            Ok(())
        }
        "buy" => {
            let spend = required_u64(action, "spend_minor")?;
            runner.run_json(
                &agent.path,
                &[
                    "trade",
                    "buy",
                    "--market",
                    required_str(action, "market")?,
                    "--side",
                    normalize_side(required_str(action, "side")?)?,
                    "--spend-minor",
                    &spend.to_string(),
                ],
            )?;
            Ok(())
        }
        "sell" => {
            runner.run_json(
                &agent.path,
                &[
                    "trade",
                    "sell",
                    "--market",
                    required_str(action, "market")?,
                    "--side",
                    normalize_side(required_str(action, "side")?)?,
                    "--quantity",
                    &required_f64(action, "quantity")?.to_string(),
                ],
            )?;
            Ok(())
        }
        "bookmark" => {
            runner.run_json(
                &agent.path,
                &["bookmarks", "add", required_str(action, "market")?],
            )?;
            Ok(())
        }
        other => bail!("unsupported action {other}"),
    }
}

fn validate_action(agent: &AgentRuntime, action: &Value) -> Result<()> {
    let name = action_name(action)?;
    if contains_forbidden_language(action) {
        bail!("action contains forbidden Cascade terminology");
    }
    match name {
        "noop" => Ok(()),
        "create_market" => {
            required_str(action, "title")?;
            required_str(action, "description")?;
            required_str(action, "slug")?;
            required_str(action, "body")?;
            normalize_side(required_str(action, "seed_side")?)?;
            let seed = required_u64(action, "seed_spend_minor")?;
            if seed == 0 || seed > agent.config.risk.max_seed_minor {
                bail!("seed_spend_minor {seed} exceeds agent max_seed_minor");
            }
            Ok(())
        }
        "start_discussion" => {
            required_str(action, "market")?;
            required_str(action, "title")?;
            required_str(action, "content")?;
            Ok(())
        }
        "reply_discussion" => {
            required_str(action, "market")?;
            required_str(action, "reply")?;
            required_str(action, "content")?;
            Ok(())
        }
        "buy" => {
            required_str(action, "market")?;
            normalize_side(required_str(action, "side")?)?;
            let spend = required_u64(action, "spend_minor")?;
            if spend == 0 || spend > agent.config.risk.max_trade_minor {
                bail!("spend_minor {spend} exceeds agent max_trade_minor");
            }
            Ok(())
        }
        "sell" => {
            required_str(action, "market")?;
            normalize_side(required_str(action, "side")?)?;
            required_f64(action, "quantity")?;
            Ok(())
        }
        "bookmark" => {
            required_str(action, "market")?;
            Ok(())
        }
        other => bail!("unsupported action {other}"),
    }
}

impl CascadeRunner {
    fn run_json(&self, config_path: &Path, args: &[&str]) -> Result<Value> {
        let args = args
            .iter()
            .map(|value| value.to_string())
            .collect::<Vec<_>>();
        self.run_json_owned(config_path, args)
    }

    fn run_json_owned(&self, config_path: &Path, args: Vec<String>) -> Result<Value> {
        let output = self.run(config_path, args)?;
        parse_cascade_stdout(&output)
            .with_context(|| format!("cascade returned non-JSON: {output}"))
    }

    fn run(&self, config_path: &Path, args: Vec<String>) -> Result<String> {
        let mut command = if let Some(path) = &self.cascade_bin {
            Command::new(path)
        } else {
            let mut command = Command::new("cargo");
            command.args([
                "run",
                "--quiet",
                "-p",
                "cascade-cli",
                "--bin",
                "cascade",
                "--manifest-path",
                "mint/Cargo.toml",
                "--",
            ]);
            command
        };
        command
            .current_dir(&self.repo_root)
            .arg("--config")
            .arg(config_path)
            .args(args);
        let output = command.output().context("failed to run cascade CLI")?;
        if !output.status.success() {
            bail!(
                "cascade exited with {}: {}{}",
                output.status,
                String::from_utf8_lossy(&output.stderr),
                String::from_utf8_lossy(&output.stdout)
            );
        }
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }
}

async fn fetch_feed_items(client: &Client, feeds: &[String]) -> Vec<FeedItem> {
    let mut out = Vec::new();
    for feed in feeds {
        let Ok(response) = client.get(feed).send().await else {
            continue;
        };
        let Ok(text) = response.text().await else {
            continue;
        };
        out.extend(parse_feed(feed, &text));
        if out.len() >= MAX_FEED_ITEMS_PER_AGENT {
            out.truncate(MAX_FEED_ITEMS_PER_AGENT);
            break;
        }
    }
    out
}

fn parse_feed(source: &str, text: &str) -> Vec<FeedItem> {
    if let Ok(value) = serde_json::from_str::<Value>(text) {
        return parse_json_feed(source, &value);
    }

    let mut items = Vec::new();
    for tag in ["item", "entry"] {
        let mut rest = text;
        let open = format!("<{tag}");
        let close = format!("</{tag}>");
        while let Some(start) = rest.find(&open) {
            rest = &rest[start..];
            let Some(open_end) = rest.find('>') else {
                break;
            };
            let after_open = &rest[open_end + 1..];
            let Some(end) = after_open.find(&close) else {
                break;
            };
            let chunk = &after_open[..end];
            if let Some(title) = extract_xml_text(chunk, "title") {
                items.push(FeedItem {
                    source: source.to_string(),
                    title,
                    link: extract_xml_text(chunk, "link")
                        .or_else(|| extract_xml_attr(chunk, "link", "href")),
                    summary: extract_xml_text(chunk, "description")
                        .or_else(|| extract_xml_text(chunk, "summary"))
                        .or_else(|| extract_xml_text(chunk, "content")),
                });
            }
            rest = &after_open[end + close.len()..];
            if items.len() >= MAX_FEED_ITEMS_PER_AGENT {
                break;
            }
        }
    }
    items.truncate(MAX_FEED_ITEMS_PER_AGENT);
    items
}

fn parse_json_feed(source: &str, value: &Value) -> Vec<FeedItem> {
    let values = if let Some(array) = value.as_array() {
        array.clone()
    } else if let Some(array) = value.get("items").and_then(Value::as_array) {
        array.clone()
    } else if let Some(array) = value.get("articles").and_then(Value::as_array) {
        array.clone()
    } else {
        Vec::new()
    };
    values
        .iter()
        .filter_map(|item| {
            let title = item
                .get("title")
                .or_else(|| item.get("headline"))
                .and_then(Value::as_str)?
                .to_string();
            Some(FeedItem {
                source: source.to_string(),
                title,
                link: item
                    .get("url")
                    .or_else(|| item.get("link"))
                    .and_then(Value::as_str)
                    .map(ToString::to_string),
                summary: item
                    .get("summary")
                    .or_else(|| item.get("description"))
                    .and_then(Value::as_str)
                    .map(clean_text),
            })
        })
        .take(MAX_FEED_ITEMS_PER_AGENT)
        .collect()
}

fn extract_xml_text(chunk: &str, tag: &str) -> Option<String> {
    let open = format!("<{tag}");
    let start = chunk.find(&open)?;
    let after = &chunk[start..];
    let open_end = after.find('>')?;
    let close = format!("</{tag}>");
    let content = &after[open_end + 1..];
    let end = content.find(&close)?;
    Some(clean_text(&content[..end]))
}

fn extract_xml_attr(chunk: &str, tag: &str, attr: &str) -> Option<String> {
    let open = format!("<{tag}");
    let start = chunk.find(&open)?;
    let after = &chunk[start..];
    let end = after.find('>')?;
    let head = &after[..end];
    let needle = format!("{attr}=\"");
    let attr_start = head.find(&needle)? + needle.len();
    let rest = &head[attr_start..];
    let attr_end = rest.find('"')?;
    Some(clean_text(&rest[..attr_end]))
}

fn clean_text(value: &str) -> String {
    let mut out = String::new();
    let mut in_tag = false;
    for ch in value.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(ch),
            _ => {}
        }
    }
    out.replace("<![CDATA[", "")
        .replace("]]>", "")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn parse_json_response(response: &str) -> Result<Value> {
    if let Ok(value) = serde_json::from_str::<Value>(response.trim()) {
        return Ok(value);
    }
    let start = response
        .find('{')
        .ok_or_else(|| anyhow!("Ollama response did not contain JSON object"))?;
    let end = response
        .rfind('}')
        .ok_or_else(|| anyhow!("Ollama response did not contain JSON object"))?;
    serde_json::from_str(&response[start..=end]).context("failed to parse Ollama JSON action")
}

fn parse_cascade_stdout(output: &str) -> Result<Value> {
    let trimmed = output.trim();
    if let Ok(value) = serde_json::from_str::<Value>(trimmed) {
        return Ok(value);
    }

    for (index, ch) in trimmed.char_indices().rev() {
        if ch == '{' || ch == '[' {
            if let Ok(value) = serde_json::from_str::<Value>(&trimmed[index..]) {
                return Ok(value);
            }
        }
    }

    bail!("stdout did not contain a complete JSON value")
}

fn action_name(action: &Value) -> Result<&str> {
    action
        .get("action")
        .and_then(Value::as_str)
        .ok_or_else(|| anyhow!("action missing string field `action`"))
}

fn required_str<'a>(value: &'a Value, field: &str) -> Result<&'a str> {
    value
        .get(field)
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| anyhow!("action missing non-empty string field `{field}`"))
}

fn required_u64(value: &Value, field: &str) -> Result<u64> {
    value
        .get(field)
        .and_then(Value::as_u64)
        .ok_or_else(|| anyhow!("action missing u64 field `{field}`"))
}

fn required_f64(value: &Value, field: &str) -> Result<f64> {
    let number = value
        .get(field)
        .and_then(Value::as_f64)
        .ok_or_else(|| anyhow!("action missing numeric field `{field}`"))?;
    if !number.is_finite() || number <= 0.0 {
        bail!("{field} must be positive");
    }
    Ok(number)
}

fn string_array(value: &Value, field: &str) -> Vec<String> {
    value
        .get(field)
        .and_then(Value::as_array)
        .map(|values| {
            values
                .iter()
                .filter_map(Value::as_str)
                .map(ToString::to_string)
                .collect()
        })
        .unwrap_or_default()
}

fn contains_forbidden_language(action: &Value) -> bool {
    let text = action.to_string().to_ascii_lowercase();
    let terms = [
        format!("{}{}", "resol", "v"),
        format!("{}{}", "resol", "ut"),
        format!("{} {}", "market", "clos"),
        format!("{} {}", "winner", "payout"),
        format!("{}{}", "pay", "out"),
        format!("{}{}", "ex", "piry"),
        format!("{}{}", "ex", "pire"),
        format!("{}{}", "or", "acle"),
    ];
    terms.iter().any(|term| text.contains(term))
}

fn normalize_side(side: &str) -> Result<&'static str> {
    match side.trim().to_ascii_lowercase().as_str() {
        "long" => Ok("long"),
        "short" => Ok("short"),
        "yes" | "no" => bail!("side must be long or short; yes/no are not supported"),
        other => bail!("unsupported side {other}; expected long or short"),
    }
}

fn slugify(value: &str) -> String {
    let mut out = String::new();
    let mut last_dash = false;
    for ch in value.chars().flat_map(char::to_lowercase) {
        if ch.is_ascii_alphanumeric() {
            out.push(ch);
            last_dash = false;
        } else if !last_dash {
            out.push('-');
            last_dash = true;
        }
    }
    let out = out.trim_matches('-').to_string();
    if out.is_empty() {
        format!("market-{}", chrono::Utc::now().timestamp())
    } else {
        out
    }
}

fn json_error(error: anyhow::Error) -> Value {
    json!({ "error": error.to_string() })
}

fn resolve_agent_profile(agent: &AgentRuntime) -> ResolvedAgentProfile {
    let config = &agent.config;
    let profile = &config.profile;
    let name = non_empty(profile.name.as_deref()).unwrap_or(&config.name);
    let picture = non_empty(profile.picture.as_deref())
        .or_else(|| non_empty(profile.avatar_url.as_deref()))
        .map(ToString::to_string)
        .unwrap_or_else(|| default_profile_picture(&config.name));
    let about = non_empty(profile.about.as_deref())
        .map(ToString::to_string)
        .unwrap_or_else(|| default_profile_about(config));
    ResolvedAgentProfile {
        name: name.to_string(),
        about,
        picture,
        banner_url: non_empty(profile.banner.as_deref())
            .or_else(|| non_empty(profile.banner_url.as_deref()))
            .map(ToString::to_string),
        website: non_empty(profile.website.as_deref()).map(ToString::to_string),
        nip05: non_empty(profile.nip05.as_deref()).map(ToString::to_string),
    }
}

fn default_profile_picture(name: &str) -> String {
    format!(
        "https://api.dicebear.com/9.x/bottts-neutral/svg?seed={}&backgroundColor=0a0a0a,171717,262626",
        slugify(name)
    )
}

fn default_profile_about(config: &AgentConfig) -> String {
    if !config.interests.is_empty() {
        return format!("Tracks {} markets on Cascade.", config.interests.join(", "));
    }
    "Tracks live Cascade markets and public signals.".to_string()
}

fn profile_signature(profile: &ResolvedAgentProfile) -> Result<String> {
    let bytes = serde_json::to_vec(profile)?;
    Ok(hex::encode(Sha256::digest(bytes)))
}

fn non_empty(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|value| !value.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_last_json_value_from_multi_value_stdout() {
        let output = "{\"published\":[]}\n{\"market_event\":{\"id\":\"abc\"}}\n";
        let parsed = parse_cascade_stdout(output).expect("parse trailing command JSON");
        assert_eq!(parsed["market_event"]["id"], "abc");
    }

    #[test]
    fn rejects_platform_incompatible_action_language() {
        let action = json!({
            "action": "create_market",
            "title": "Example market",
            "description": format!("This market has a diplomatic {}.", format!("{}{}", "resol", "ution")),
            "body": "Example",
            "slug": "example-market",
            "seed_side": "long",
            "seed_spend_minor": 1000
        });
        assert!(contains_forbidden_language(&action));
    }

    #[test]
    fn derives_default_profile_picture_from_agent_name() {
        assert_eq!(
            default_profile_picture("AI Infrastructure Hawk"),
            "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=ai-infrastructure-hawk&backgroundColor=0a0a0a,171717,262626"
        );
    }
}

fn read_agent_config(path: &Path) -> Result<AgentConfig> {
    let raw = fs::read_to_string(path)
        .with_context(|| format!("failed to read agent config {}", path.display()))?;
    serde_json::from_str(&raw).with_context(|| format!("failed to parse {}", path.display()))
}

fn validate_agent_config(path: &Path, config: &AgentConfig) -> Result<()> {
    if config.name.trim().is_empty() {
        bail!("{} has empty name", path.display());
    }
    if config.edition != "signet" && config.edition != "mainnet" {
        bail!("{} edition must be signet or mainnet", path.display());
    }
    if config.api_base_url.trim().is_empty() {
        bail!("{} missing api_base_url", path.display());
    }
    if config.identity.nsec.trim().is_empty() {
        bail!("{} missing identity.nsec", path.display());
    }
    if config.proof_store.trim().is_empty() {
        bail!("{} missing proof_store", path.display());
    }
    if config.system_prompt.trim().is_empty() {
        bail!("{} missing system_prompt", path.display());
    }
    Ok(())
}

fn load_state(repo_root: &Path) -> Result<SimState> {
    let path = repo_root.join(STATE_PATH);
    if !path.exists() {
        return Ok(SimState::default());
    }
    let raw = fs::read_to_string(&path)?;
    serde_json::from_str(&raw).context("failed to parse simulator state")
}

fn save_state(repo_root: &Path, state: &SimState) -> Result<()> {
    let path = repo_root.join(STATE_PATH);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, format!("{}\n", serde_json::to_string_pretty(state)?))?;
    Ok(())
}

fn expand_agent_args(repo_root: &Path, values: &[String]) -> Result<Vec<PathBuf>> {
    let mut paths = Vec::new();
    for value in values {
        paths.extend(expand_agent_arg(repo_root, value)?);
    }
    paths.sort();
    paths.dedup();
    Ok(paths)
}

fn expand_agent_arg(repo_root: &Path, value: &str) -> Result<Vec<PathBuf>> {
    if !value.contains('*') {
        let path = repo_root.join(value);
        return Ok(if path.exists() {
            vec![path]
        } else {
            Vec::new()
        });
    }
    let path = Path::new(value);
    let dir = path.parent().unwrap_or_else(|| Path::new("."));
    let pattern = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| anyhow!("invalid agent glob {value}"))?;
    let Some(star) = pattern.find('*') else {
        return Ok(Vec::new());
    };
    let prefix = &pattern[..star];
    let suffix = &pattern[star + 1..];
    let dir = repo_root.join(dir);
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut paths = Vec::new();
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.starts_with(prefix) && name.ends_with(suffix) {
            paths.push(entry.path());
        }
    }
    Ok(paths)
}

fn find_repo_root() -> Result<PathBuf> {
    let mut current = std::env::current_dir()?;
    loop {
        if current.join("mint/Cargo.toml").exists() {
            return Ok(current);
        }
        if !current.pop() {
            bail!("failed to find repo root containing mint/Cargo.toml");
        }
    }
}

fn find_sibling_cascade_binary() -> Option<PathBuf> {
    let current = std::env::current_exe().ok()?;
    let dir = current.parent()?;
    let candidate = dir.join("cascade");
    if candidate.exists() {
        Some(candidate)
    } else {
        None
    }
}

fn agent_key(agent: &AgentRuntime) -> String {
    format!(
        "{}:{}",
        agent.config.name,
        agent
            .path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
    )
}

fn default_enabled() -> bool {
    true
}

fn default_version() -> u64 {
    1
}

fn default_bootstrap_usd_minor() -> u64 {
    10_000
}

fn default_max_trade_minor() -> u64 {
    2_500
}

fn default_max_seed_minor() -> u64 {
    5_000
}
