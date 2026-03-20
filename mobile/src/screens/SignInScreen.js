import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Linking } from 'react-native'
import { supabase } from '../lib/supabase'
import { colors } from '../theme/colors'

export default function SignInScreen() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Reset loading when app comes back to foreground
  React.useEffect(() => {
    const handleAppState = Linking.addEventListener('url', () => {
      // Give it a few seconds to process the deep link, then reset
      setTimeout(() => setLoading(false), 5000)
    })
    return () => handleAppState.remove()
  }, [])

  const handleSignIn = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'snipsync://auth/callback',
          skipBrowserRedirect: true,
        },
      })
      if (oauthError) throw oauthError
      if (data?.url) {
        await Linking.openURL(data.url)
        // Reset loading after 15s if nothing happens
        setTimeout(() => {
          setLoading(false)
          setError('Sign in timed out. Please try again.')
        }, 15000)
      }
    } catch (err) {
      setError(err.message || 'Could not open sign in page.')
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image
          source={require('../assets/app-icon.png')}
          style={styles.appIcon}
        />
        <Text style={styles.logo}>SnipSync</Text>
        <Text style={styles.subtitle}>Your clipboard, everywhere.</Text>

        <TouchableOpacity
          style={styles.signInBtn}
          onPress={handleSignIn}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.signInText}>Sign in with Google</Text>
          )}
        </TouchableOpacity>

        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      <Text style={styles.footer}>snipsync.xyz</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  content: {
    alignItems: 'center',
    width: '100%',
  },
  appIcon: {
    width: 100,
    height: 100,
    borderRadius: 22,
    marginBottom: 20,
  },
  logo: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.green,
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 48,
  },
  signInBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  signInText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  error: {
    color: colors.error,
    fontSize: 13,
    marginTop: 16,
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    fontSize: 12,
    color: colors.textDim,
  },
})
