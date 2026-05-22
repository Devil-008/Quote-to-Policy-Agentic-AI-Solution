import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../services/api'

export const loginUser = createAsyncThunk('auth/login', async (creds, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/auth/login', creds)
    localStorage.setItem('access_token',  data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    return data
  } catch (e) { return rejectWithValue(e.response?.data?.detail || 'Login failed') }
})

export const registerUser = createAsyncThunk('auth/register', async (body, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/auth/register', body)
    return data
  } catch (e) { return rejectWithValue(e.response?.data?.detail || 'Registration failed') }
})

const _stored = () => {
  try {
    const t = localStorage.getItem('access_token')
    if (!t) return null
    const p = JSON.parse(atob(t.split('.')[1]))
    return { id: p.sub, role: p.role }
  } catch { return null }
}

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user:    _stored(),
    token:   localStorage.getItem('access_token'),
    loading: false,
    error:   null,
  },
  reducers: {
    logout(state) {
      state.user = null; state.token = null
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
    },
    clearError(state) { state.error = null },
  },
  extraReducers: b => {
    b.addCase(loginUser.pending,   s => { s.loading = true;  s.error = null })
     .addCase(loginUser.fulfilled, (s, a) => {
       s.loading = false; s.token = a.payload.access_token; s.user = a.payload.user
     })
     .addCase(loginUser.rejected,  (s, a) => { s.loading = false; s.error = a.payload })
     .addCase(registerUser.pending,   s => { s.loading = true; s.error = null })
     .addCase(registerUser.fulfilled, s => { s.loading = false })
     .addCase(registerUser.rejected,  (s, a) => { s.loading = false; s.error = a.payload })
  }
})
export const { logout, clearError } = authSlice.actions
export default authSlice.reducer
