import { createSlice } from '@reduxjs/toolkit'
const uiSlice = createSlice({
  name: 'ui',
  initialState: { sidebarOpen: true, toasts: [] },
  reducers: {
    toggleSidebar: s => { s.sidebarOpen = !s.sidebarOpen },
    addToast:   (s, a) => { s.toasts.push({ id: Date.now(), ...a.payload }) },
    removeToast:(s, a) => { s.toasts = s.toasts.filter(t => t.id !== a.payload) },
  }
})
export const { toggleSidebar, addToast, removeToast } = uiSlice.actions
export default uiSlice.reducer
