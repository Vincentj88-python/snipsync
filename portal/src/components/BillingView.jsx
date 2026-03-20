import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

async function getTeamSubscription(teamId) {
  const { data } = await supabase.from('team_subscriptions').select('*').eq('team_id', teamId).single()
  return data
}

export default function BillingView({ teamId, isOwner }) {
  const [sub, setSub] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSub()
  }, [teamId])

  const loadSub = async () => {
    const data = await getTeamSubscription(teamId)
    setSub(data)
    setLoading(false)
  }

  if (loading) return <p className="text-dim">Loading billing info...</p>
  if (!sub) return <p className="text-dim">No subscription found.</p>

  const pricePerSeat = 8.99
  const monthlyTotal = (sub.seat_count * pricePerSeat).toFixed(2)

  return (
    <div className="billing-view">
      <h3>Billing</h3>

      <div className="billing-cards">
        <div className="billing-card">
          <span className="billing-card-label">Plan</span>
          <span className={`billing-card-value billing-status--${sub.plan}`}>
            {sub.plan === 'active' ? 'Team Active' : sub.plan === 'trial' ? 'Trial' : sub.plan === 'past_due' ? 'Past Due' : 'Cancelled'}
          </span>
        </div>

        <div className="billing-card">
          <span className="billing-card-label">Seats</span>
          <span className="billing-card-value">
            {sub.seat_count}{sub.max_seats ? ` / ${sub.max_seats}` : ''}
          </span>
        </div>

        <div className="billing-card">
          <span className="billing-card-label">Monthly cost</span>
          <span className="billing-card-value">${monthlyTotal}</span>
          <span className="billing-card-hint">${pricePerSeat}/seat/month</span>
        </div>

        {sub.current_period_end && (
          <div className="billing-card">
            <span className="billing-card-label">Next billing</span>
            <span className="billing-card-value">{new Date(sub.current_period_end).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {sub.plan === 'trial' && (
        <div className="billing-trial-notice">
          <p>Your team is on a trial. Subscribe to keep access after the trial ends.</p>
          {isOwner && (
            <button className="btn-primary" disabled>
              Subscribe — coming soon
            </button>
          )}
        </div>
      )}

      {sub.plan === 'past_due' && (
        <div className="billing-warning">
          <p>Payment failed. Please update your payment method to avoid losing access.</p>
        </div>
      )}

      {isOwner && sub.ls_subscription_id && (
        <div className="billing-manage">
          <p className="text-dim">Manage your subscription, update payment method, or cancel via the Lemon Squeezy customer portal.</p>
          <button className="btn-ghost" disabled>
            Manage subscription — coming soon
          </button>
        </div>
      )}
    </div>
  )
}
