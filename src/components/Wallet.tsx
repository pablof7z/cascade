import { useState, useEffect, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { loadStoredKeys } from '../nostrKeys'
import { loadOrCreateWallet, getWalletBalance, createDeposit, sendTokens, receiveToken } from '../walletStore'
import type { NDKCashuDeposit } from '@nostr-dev-kit/wallet'

type WalletStatus = 'disconnected' | 'connecting' | 'ready' | 'error'

export default function Wallet() {
  const [status, setStatus] = useState<WalletStatus>('disconnected')
  const [balance, setBalance] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [showDeposit, setShowDeposit] = useState(false)
  const [showSend, setShowSend] = useState(false)
  const [showReceive, setShowReceive] = useState(false)
  const [depositAmount, setDepositAmount] = useState('')
  const [deposit, setDeposit] = useState<NDKCashuDeposit | null>(null)
  const [bolt11, setBolt11] = useState<string | null>(null)
  const [sendAmount, setSendAmount] = useState('')
  const [sendResult, setSendResult] = useState<string | null>(null)
  const [receiveToken_, setReceiveToken] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const keys = loadStoredKeys()

  const refreshBalance = useCallback(async () => {
    const bal = await getWalletBalance()
    setBalance(bal)
  }, [])

  useEffect(() => {
    if (!keys) return

    async function init() {
      setStatus('connecting')
      try {
        const wallet = await loadOrCreateWallet()
        if (wallet) {
          setStatus('ready')
          await refreshBalance()

          // Listen for balance updates
          wallet.on('balance_updated', () => {
            refreshBalance()
          })
        } else {
          setStatus('error')
          setError('Failed to initialize wallet')
        }
      } catch (e) {
        setStatus('error')
        setError(e instanceof Error ? e.message : 'Unknown error')
      }
    }

    init()
  }, [keys, refreshBalance])

  const handleDeposit = async () => {
    const amount = parseInt(depositAmount)
    if (!amount || amount < 1) return

    setActionLoading(true)
    setError(null)
    
    try {
      const dep = await createDeposit(amount)

      if (dep) {
        setDeposit(dep)
        
        // Get the bolt11 invoice - check various property names
        const invoice = (dep as any).pr || (dep as any).bolt11 || dep.quoteId
        if (invoice) {
          setBolt11(invoice)
        }
        
        // Listen for success
        dep.on('success', () => {
          setDeposit(null)
          setBolt11(null)
          setShowDeposit(false)
          setDepositAmount('')
          refreshBalance()
        })
        dep.on('error', (err) => {
          setError(`Deposit failed: ${err}`)
        })
      } else {
        setError('Failed to create deposit')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create deposit')
    }
    
    setActionLoading(false)
  }

  const handleSend = async () => {
    const amount = parseInt(sendAmount)
    if (!amount || amount < 1 || amount > balance) return

    setActionLoading(true)
    const token = await sendTokens(amount)
    setActionLoading(false)

    if (token) {
      setSendResult(token)
      await refreshBalance()
    } else {
      setError('Failed to send tokens')
    }
  }

  const handleReceive = async () => {
    if (!receiveToken_.trim()) return

    setActionLoading(true)
    const success = await receiveToken(receiveToken_)
    setActionLoading(false)

    if (success) {
      setReceiveToken('')
      setShowReceive(false)
      await refreshBalance()
    } else {
      setError('Failed to receive token')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  if (!keys) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
        <p className="text-neutral-400">Create a profile first to use your wallet.</p>
      </div>
    )
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Wallet</h2>
        <span className={`text-xs px-2 py-1 rounded ${
          status === 'ready' ? 'bg-green-900 text-green-300' :
          status === 'connecting' ? 'bg-yellow-900 text-yellow-300' :
          status === 'error' ? 'bg-red-900 text-red-300' :
          'bg-neutral-800 text-neutral-400'
        }`}>
          {status === 'ready' ? 'Connected' :
           status === 'connecting' ? 'Connecting...' :
           status === 'error' ? 'Error' : 'Disconnected'}
        </span>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded text-red-300 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Balance Display */}
      <div className="text-center py-6 border-b border-neutral-800 mb-4">
        <p className="text-4xl font-bold text-white">{balance.toLocaleString()}</p>
        <p className="text-neutral-400 text-sm mt-1">sats</p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={() => { setShowDeposit(true); setShowSend(false); setShowReceive(false); }}
          disabled={status !== 'ready'}
          className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Deposit
        </button>
        <button
          onClick={() => { setShowSend(true); setShowDeposit(false); setShowReceive(false); }}
          disabled={status !== 'ready' || balance === 0}
          className="flex-1 px-4 py-2.5 bg-neutral-700 hover:bg-neutral-600 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
        <button
          onClick={() => { setShowReceive(true); setShowDeposit(false); setShowSend(false); }}
          disabled={status !== 'ready'}
          className="flex-1 px-4 py-2.5 bg-neutral-700 hover:bg-neutral-600 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Receive
        </button>
      </div>

      {/* Deposit Panel */}
      {showDeposit && (
        <div className="border border-neutral-700 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-medium text-white mb-3">Deposit via Lightning</h3>
          {!deposit ? (
            <>
              <input
                type="number"
                placeholder="Amount in sats"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded text-white placeholder:text-neutral-500 mb-3"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleDeposit}
                  disabled={actionLoading || !depositAmount}
                  className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded disabled:opacity-50"
                >
                  {actionLoading ? 'Creating...' : 'Create Invoice'}
                </button>
                <button
                  onClick={() => setShowDeposit(false)}
                  className="px-3 py-2 text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              {/* QR Code Display */}
              {bolt11 && (
                <div className="flex justify-center mb-4">
                  <div className="bg-white p-3 rounded-lg">
                    <QRCodeSVG value={bolt11.toUpperCase()} size={200} />
                  </div>
                </div>
              )}
              <div className="bg-neutral-950 p-3 rounded mb-3">
                <p className="text-xs text-neutral-400 mb-1">Lightning Invoice</p>
                <p className="text-xs text-white font-mono break-all">{bolt11 || 'Generating...'}</p>
              </div>
              <p className="text-xs text-neutral-400 mb-3">Scan QR code or copy invoice to deposit {parseInt(depositAmount).toLocaleString()} sats. Waiting for payment...</p>
              <div className="flex gap-2">
                {bolt11 && (
                  <button
                    onClick={() => copyToClipboard(bolt11)}
                    className="flex-1 px-3 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded"
                  >
                    Copy Invoice
                  </button>
                )}
                <button
                  onClick={() => { setDeposit(null); setBolt11(null); setShowDeposit(false); setDepositAmount(''); }}
                  className="px-3 py-2 text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Send Panel */}
      {showSend && (
        <div className="border border-neutral-700 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-medium text-white mb-3">Send Cashu Tokens</h3>
          {!sendResult ? (
            <>
              <input
                type="number"
                placeholder="Amount in sats"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                max={balance}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded text-white placeholder:text-neutral-500 mb-3"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSend}
                  disabled={actionLoading || !sendAmount || parseInt(sendAmount) > balance}
                  className="flex-1 px-3 py-2 bg-neutral-600 hover:bg-neutral-500 text-white rounded disabled:opacity-50"
                >
                  {actionLoading ? 'Sending...' : 'Send'}
                </button>
                <button
                  onClick={() => setShowSend(false)}
                  className="px-3 py-2 text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="bg-neutral-950 p-3 rounded mb-3">
                <p className="text-xs text-neutral-400 mb-1">Cashu Token (share this)</p>
                <p className="text-xs text-white font-mono break-all">{sendResult}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(sendResult)}
                  className="flex-1 px-3 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded"
                >
                  Copy Token
                </button>
                <button
                  onClick={() => { setSendResult(null); setShowSend(false); setSendAmount(''); }}
                  className="px-3 py-2 text-neutral-400 hover:text-white"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Receive Panel */}
      {showReceive && (
        <div className="border border-neutral-700 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-medium text-white mb-3">Receive Cashu Token</h3>
          <textarea
            placeholder="Paste cashu token here..."
            value={receiveToken_}
            onChange={(e) => setReceiveToken(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded text-white placeholder:text-neutral-500 mb-3 resize-none font-mono text-xs"
          />
          <div className="flex gap-2">
            <button
              onClick={handleReceive}
              disabled={actionLoading || !receiveToken_.trim()}
              className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded disabled:opacity-50"
            >
              {actionLoading ? 'Receiving...' : 'Receive'}
            </button>
            <button
              onClick={() => setShowReceive(false)}
              className="px-3 py-2 text-neutral-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Info */}
      <p className="text-xs text-neutral-500 text-center">
        Powered by Cashu • Mint: minibits.cash
      </p>
    </div>
  )
}
