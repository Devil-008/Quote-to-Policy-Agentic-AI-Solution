import { configureStore } from '@reduxjs/toolkit'
import authReducer  from './slices/authSlice'
import casesReducer from './slices/casesSlice'
import uiReducer    from './slices/uiSlice'

export const store = configureStore({
  reducer: { auth: authReducer, cases: casesReducer, ui: uiReducer }
})
