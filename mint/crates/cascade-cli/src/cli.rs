use clap::{ArgAction, Args, Parser, Subcommand};

#[derive(Debug, Parser)]
#[command(name = "cascade")]
#[command(about = "Cascade CLI")]
pub struct Cli {
    #[arg(long, global = true, action = ArgAction::SetTrue)]
    pub signet: bool,
    #[arg(long, global = true, action = ArgAction::SetTrue)]
    pub mainnet: bool,
    #[arg(long, global = true)]
    pub config: Option<String>,
    #[arg(long, global = true)]
    pub api_base: Option<String>,
    #[arg(long, global = true)]
    pub relay: Vec<String>,
    #[arg(long, global = true, action = ArgAction::SetTrue)]
    pub human: bool,
    #[command(subcommand)]
    pub command: Command,
}

#[derive(Debug, Subcommand)]
pub enum Command {
    Identity(IdentityCommand),
    Market(MarketCommand),
    Trade(TradeCommand),
    Portfolio(PortfolioCommand),
    Proofs(ProofsCommand),
    Position(PositionCommand),
    Profile(ProfileCommand),
    Bookmarks(BookmarksCommand),
    Discussion(DiscussionCommand),
    Feed(FeedCommand),
    Activity(ActivityCommand),
    Analytics(AnalyticsCommand),
    Leaderboard(LeaderboardCommand),
    Api(ApiCommand),
}

#[derive(Debug, Args)]
pub struct IdentityCommand {
    #[command(subcommand)]
    pub command: IdentitySubcommand,
}

#[derive(Debug, Subcommand)]
pub enum IdentitySubcommand {
    Init(IdentityInitArgs),
    Show,
}

#[derive(Debug, Args)]
pub struct IdentityInitArgs {
    #[arg(long)]
    pub nsec: Option<String>,
    #[arg(long)]
    pub name: Option<String>,
    #[arg(long)]
    pub about: Option<String>,
    #[arg(long = "avatar-url")]
    pub avatar_url: Option<String>,
    #[arg(long = "banner-url")]
    pub banner_url: Option<String>,
    #[arg(long)]
    pub website: Option<String>,
    #[arg(long)]
    pub nip05: Option<String>,
}

#[derive(Debug, Args)]
pub struct MarketCommand {
    #[command(subcommand)]
    pub command: MarketSubcommand,
}

#[derive(Debug, Subcommand)]
pub enum MarketSubcommand {
    List(MarketListArgs),
    Show(MarketSelectorArg),
    Pending(MarketPendingArgs),
    PriceHistory(MarketSelectorWithLimitArgs),
    Activity(MarketSelectorWithLimitArgs),
    Create(MarketCreateArgs),
}

#[derive(Debug, Args)]
pub struct MarketListArgs {
    #[arg(long)]
    pub creator: Option<String>,
    #[arg(long)]
    pub limit: Option<usize>,
    #[arg(long, default_value = "public")]
    pub visibility: String,
}

#[derive(Debug, Args)]
pub struct MarketSelectorArg {
    pub market: String,
}

#[derive(Debug, Args)]
pub struct MarketSelectorWithLimitArgs {
    pub market: String,
    #[arg(long)]
    pub limit: Option<usize>,
}

#[derive(Debug, Args)]
pub struct MarketPendingArgs {
    pub event_id: String,
    #[arg(long)]
    pub creator: Option<String>,
}

#[derive(Debug, Args)]
pub struct MarketCreateArgs {
    pub spec: Option<String>,
    #[arg(long)]
    pub title: Option<String>,
    #[arg(long)]
    pub description: Option<String>,
    #[arg(long)]
    pub slug: Option<String>,
    #[arg(long)]
    pub body: Option<String>,
    #[arg(long = "seed-side")]
    pub seed_side: String,
    #[arg(long = "seed-spend-minor")]
    pub seed_spend_minor: u64,
    #[arg(long = "category")]
    pub categories: Vec<String>,
    #[arg(long = "topic")]
    pub topics: Vec<String>,
    #[arg(long = "request-id")]
    pub request_id: Option<String>,
}

#[derive(Debug, Args)]
pub struct TradeCommand {
    #[command(subcommand)]
    pub command: TradeSubcommand,
}

#[derive(Debug, Subcommand)]
pub enum TradeSubcommand {
    Quote(TradeQuoteCommand),
    Buy(TradeBuyArgs),
    Sell(TradeSellArgs),
    Status(IdArg),
    RequestStatus(IdArg),
    QuoteStatus(IdArg),
}

#[derive(Debug, Args)]
pub struct TradeQuoteCommand {
    #[command(subcommand)]
    pub command: TradeQuoteSubcommand,
}

#[derive(Debug, Subcommand)]
pub enum TradeQuoteSubcommand {
    Buy(TradeQuoteBuyArgs),
    Sell(TradeQuoteSellArgs),
}

#[derive(Debug, Args)]
pub struct TradeQuoteBuyArgs {
    #[arg(long)]
    pub market: String,
    #[arg(long)]
    pub side: String,
    #[arg(long = "spend-minor")]
    pub spend_minor: u64,
}

#[derive(Debug, Args)]
pub struct TradeQuoteSellArgs {
    #[arg(long)]
    pub market: String,
    #[arg(long)]
    pub side: String,
    #[arg(long)]
    pub quantity: f64,
}

#[derive(Debug, Args)]
pub struct TradeBuyArgs {
    #[arg(long)]
    pub market: String,
    #[arg(long)]
    pub side: String,
    #[arg(long = "spend-minor")]
    pub spend_minor: u64,
    #[arg(long = "quote-id")]
    pub quote_id: Option<String>,
    #[arg(long = "request-id")]
    pub request_id: Option<String>,
}

#[derive(Debug, Args)]
pub struct TradeSellArgs {
    #[arg(long)]
    pub market: String,
    #[arg(long)]
    pub side: String,
    #[arg(long)]
    pub quantity: f64,
    #[arg(long = "quote-id")]
    pub quote_id: Option<String>,
    #[arg(long = "request-id")]
    pub request_id: Option<String>,
}

#[derive(Debug, Args)]
pub struct IdArg {
    pub id: String,
}

#[derive(Debug, Args)]
pub struct PortfolioCommand {
    #[command(subcommand)]
    pub command: PortfolioSubcommand,
}

#[derive(Debug, Subcommand)]
pub enum PortfolioSubcommand {
    Show,
    Faucet(PortfolioFaucetArgs),
    #[command(alias = "topup")]
    Funding(PortfolioFundingCommand),
}

#[derive(Debug, Args)]
pub struct PortfolioFaucetArgs {
    #[arg(long = "amount-minor")]
    pub amount_minor: u64,
}

#[derive(Debug, Args)]
pub struct PortfolioFundingCommand {
    #[command(subcommand)]
    pub command: PortfolioFundingSubcommand,
}

#[derive(Debug, Subcommand)]
pub enum PortfolioFundingSubcommand {
    Lightning(PortfolioLightningFundingCommand),
    Status(IdArg),
    RequestStatus(IdArg),
    Settle(IdArg),
}

#[derive(Debug, Args)]
pub struct PortfolioLightningFundingCommand {
    #[command(subcommand)]
    pub command: PortfolioLightningFundingSubcommand,
}

#[derive(Debug, Subcommand)]
pub enum PortfolioLightningFundingSubcommand {
    Quote(PortfolioLightningFundingQuoteArgs),
}

#[derive(Debug, Args)]
pub struct PortfolioLightningFundingQuoteArgs {
    #[arg(long = "amount-minor")]
    pub amount_minor: u64,
    #[arg(long = "request-id")]
    pub request_id: Option<String>,
}

#[derive(Debug, Args)]
pub struct ProofsCommand {
    #[command(subcommand)]
    pub command: ProofsSubcommand,
}

#[derive(Debug, Subcommand)]
pub enum ProofsSubcommand {
    List,
    Balance,
    Show(ProofsUnitArgs),
    Import(ProofsImportArgs),
    Export(ProofsUnitArgs),
    Remove(ProofsRemoveArgs),
}

#[derive(Debug, Args)]
pub struct ProofsUnitArgs {
    #[arg(long)]
    pub unit: String,
}

#[derive(Debug, Args)]
pub struct ProofsImportArgs {
    pub token: String,
}

#[derive(Debug, Args)]
pub struct ProofsRemoveArgs {
    #[arg(long)]
    pub unit: String,
    #[arg(long = "secret", required = true)]
    pub secrets: Vec<String>,
}

#[derive(Debug, Args)]
pub struct PositionCommand {
    #[command(subcommand)]
    pub command: PositionSubcommand,
}

#[derive(Debug, Subcommand)]
pub enum PositionSubcommand {
    Sync,
}

#[derive(Debug, Args)]
pub struct ProfileCommand {
    #[command(subcommand)]
    pub command: ProfileSubcommand,
}

#[derive(Debug, Subcommand)]
pub enum ProfileSubcommand {
    Show(ProfileShowArgs),
    Update(ProfileUpdateArgs),
    Follow(ProfileIdentifierArgs),
    Unfollow(ProfileIdentifierArgs),
    Follows(ProfileIdentifierArgs),
}

#[derive(Debug, Args)]
pub struct ProfileShowArgs {
    pub identifier: String,
}

#[derive(Debug, Args)]
pub struct ProfileIdentifierArgs {
    pub identifier: String,
}

#[derive(Debug, Args)]
pub struct ProfileUpdateArgs {
    #[arg(long)]
    pub name: Option<String>,
    #[arg(long)]
    pub about: Option<String>,
    #[arg(long = "avatar-url")]
    pub avatar_url: Option<String>,
    #[arg(long = "banner-url")]
    pub banner_url: Option<String>,
    #[arg(long)]
    pub website: Option<String>,
    #[arg(long)]
    pub nip05: Option<String>,
}

#[derive(Debug, Args)]
pub struct BookmarksCommand {
    #[command(subcommand)]
    pub command: BookmarksSubcommand,
}

#[derive(Debug, Subcommand)]
pub enum BookmarksSubcommand {
    List,
    Add(MarketSelectorArg),
    Remove(MarketSelectorArg),
}

#[derive(Debug, Args)]
pub struct DiscussionCommand {
    #[arg(long)]
    pub market: String,
    #[arg(long)]
    pub thread: Option<String>,
    #[arg(long)]
    pub title: Option<String>,
    #[arg(long)]
    pub reply: Option<String>,
    #[arg(long)]
    pub content: Option<String>,
}

#[derive(Debug, Args)]
pub struct FeedCommand {
    #[command(subcommand)]
    pub command: FeedSubcommand,
}

#[derive(Debug, Subcommand)]
pub enum FeedSubcommand {
    Home,
}

#[derive(Debug, Args)]
pub struct ActivityCommand {
    #[command(subcommand)]
    pub command: ActivitySubcommand,
}

#[derive(Debug, Subcommand)]
pub enum ActivitySubcommand {
    List(ActivityListArgs),
}

#[derive(Debug, Args)]
pub struct ActivityListArgs {
    #[arg(long)]
    pub limit: Option<usize>,
}

#[derive(Debug, Args)]
pub struct AnalyticsCommand {
    #[command(subcommand)]
    pub command: AnalyticsSubcommand,
}

#[derive(Debug, Subcommand)]
pub enum AnalyticsSubcommand {
    Summary,
}

#[derive(Debug, Args)]
pub struct LeaderboardCommand {
    #[command(subcommand)]
    pub command: LeaderboardSubcommand,
}

#[derive(Debug, Subcommand)]
pub enum LeaderboardSubcommand {
    Show,
}

#[derive(Debug, Args)]
pub struct ApiCommand {
    #[command(subcommand)]
    pub command: ApiSubcommand,
}

#[derive(Debug, Subcommand)]
pub enum ApiSubcommand {
    Request(ApiRequestArgs),
}

#[derive(Debug, Args)]
pub struct ApiRequestArgs {
    pub method: String,
    pub target: String,
    pub body: Option<String>,
    #[arg(long, default_value = "auto")]
    pub auth: String,
}
