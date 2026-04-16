'use client'
import { useState, useEffect } from 'react'

export const SETTINGS_STORAGE_KEY = 'pexip-basic-import-settings-v1'

interface BrowserCredentialStore {
  get: (options?: unknown) => Promise<{ id?: string; password?: string } | null>
}

export function useCredentials() {
  const [baseUrl, setBaseUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
        let savedUsername = ''
        if (raw) {
          const saved = JSON.parse(raw) as { baseUrl?: string; username?: string }
          if (saved.baseUrl) setBaseUrl(saved.baseUrl)
          if (saved.username) {
            savedUsername = saved.username
            setUsername(saved.username)
          }
        }

        const savedPassword = window.sessionStorage.getItem(`${SETTINGS_STORAGE_KEY}-pw`)
        if (savedPassword) setPassword(savedPassword)

        if ('credentials' in navigator) {
          const credential = await (navigator.credentials as BrowserCredentialStore).get({
            password: true,
            mediation: 'optional'
          })
          if (credential?.id && !savedUsername) setUsername(credential.id)
          if (credential?.password) setPassword(credential.password)
        }
      } catch {
        // ignore
      } finally {
        setLoaded(true)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { baseUrl, username, password, loaded }
}
