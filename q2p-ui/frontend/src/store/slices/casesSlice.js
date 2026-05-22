import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../services/api'

export const fetchCases = createAsyncThunk('cases/fetch', async (_, { rejectWithValue }) => {
  try { return (await api.get('/cases/')).data.cases }
  catch (e) { return rejectWithValue(e.response?.data?.detail) }
})

export const createCase = createAsyncThunk('cases/create', async (body, { rejectWithValue }) => {
  try { return (await api.post('/cases/', body)).data }
  catch (e) { return rejectWithValue(e.response?.data?.detail) }
})

const casesSlice = createSlice({
  name: 'cases',
  initialState: { list: [], loading: false, error: null },
  reducers: { clearError: s => { s.error = null } },
  extraReducers: b => {
    b.addCase(fetchCases.pending,   s => { s.loading = true })
     .addCase(fetchCases.fulfilled, (s, a) => { s.loading = false; s.list = a.payload })
     .addCase(fetchCases.rejected,  (s, a) => { s.loading = false; s.error = a.payload })
     .addCase(createCase.fulfilled, (s, a) => { s.list.unshift(a.payload.case || a.payload) })
  }
})
export const { clearError } = casesSlice.actions
export default casesSlice.reducer
