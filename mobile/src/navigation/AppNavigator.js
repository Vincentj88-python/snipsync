import React, { useState, useEffect } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { supabase, signOut } from '../lib/supabase'
import { colors } from '../theme/colors'
import SignInScreen from '../screens/SignInScreen'
import ClipListScreen from '../screens/ClipListScreen'
import { View, Text, ActivityIndicator, StyleSheet, Linking } from 'react-native'

const Stack = createNativeStackNavigator()

export default function AppNavigator() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [debugUrl, setDebugUrl] = useState(null)

  // Handle OAuth deep links at the top level
  useEffect(() => {
    const handleDeepLink = async (url) => {
      if (!url) return
      setDebugUrl(url) // Show what URL we received
      try {
        // PKCE flow: snipsync://auth/callback?code=xxx
        if (url.includes('code=')) {
          const codeMatch = url.match(/[?&]code=([^&#]+)/)
          const code = codeMatch?.[1]
          if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code)
            if (error) setDebugUrl(`Exchange error: ${error.message}`)
          }
        }
        // Implicit flow fallback: snipsync://auth/callback#access_token=xxx
        else if (url.includes('access_token')) {
          const fragment = url.split('#')[1]
          if (fragment) {
            const params = new URLSearchParams(fragment)
            const access_token = params.get('access_token')
            const refresh_token = params.get('refresh_token')
            if (access_token) {
              await supabase.auth.setSession({ access_token, refresh_token })
            }
          }
        } else {
          setDebugUrl(`No code or token in URL: ${url}`)
        }
      } catch (err) {
        setDebugUrl(`Error: ${err.message}`)
      }
    }

    // App opened via deep link while running
    const subscription = Linking.addEventListener('url', ({ url }) => handleDeepLink(url))

    // App launched via deep link (cold start)
    Linking.getInitialURL().then(handleDeepLink)

    return () => subscription.remove()
  }, [])

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.green} size="large" />
      </View>
    )
  }

  const handleSignOut = async () => {
    await signOut()
    setUser(null)
  }

  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: colors.green,
          background: colors.bg,
          card: colors.bg,
          text: colors.text,
          border: colors.cardBorder,
          notification: colors.green,
        },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: '400' },
          medium: { fontFamily: 'System', fontWeight: '500' },
          bold: { fontFamily: 'System', fontWeight: '700' },
          heavy: { fontFamily: 'System', fontWeight: '800' },
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="ClipList">
            {() => <ClipListScreen user={user} onSignOut={handleSignOut} />}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="SignIn">
            {() => <><SignInScreen />{debugUrl && <View style={styles.debug}><Text style={styles.debugText}>{debugUrl}</Text></View>}</>}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  debug: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 12,
  },
  debugText: {
    color: '#f59e0b',
    fontSize: 10,
    fontFamily: 'Courier',
  },
})
