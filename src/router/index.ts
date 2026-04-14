import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '@/pages/HomePage.vue'
import AssetsPage from '@/pages/AssetsPage.vue'
import LiabilitiesPage from '@/pages/LiabilitiesPage.vue'
import SettingsPage from '@/pages/SettingsPage.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: HomePage
  },
  {
    path: '/assets',
    name: 'Assets',
    component: AssetsPage
  },
  {
    path: '/liabilities',
    name: 'Liabilities',
    component: LiabilitiesPage
  },
  {
    path: '/settings',
    name: 'Settings',
    component: SettingsPage
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router