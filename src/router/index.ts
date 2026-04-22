import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '@/pages/HomePage.vue'
import AssetsPage from '@/pages/AssetsPage.vue'
import LiabilitiesPage from '@/pages/LiabilitiesPage.vue'
import SettingsPage from '@/pages/SettingsPage.vue'
import StatisticsPage from '@/pages/StatisticsPage.vue'
import AssetCategoryPage from '@/pages/AssetCategoryPage.vue'
import LiabilityCategoryPage from '@/pages/LiabilityCategoryPage.vue'

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
    path: '/assets/c/:name',
    name: 'AssetCategory',
    component: AssetCategoryPage
  },
  {
    path: '/liabilities',
    name: 'Liabilities',
    component: LiabilitiesPage
  },
  {
    path: '/liabilities/c/:name',
    name: 'LiabilityCategory',
    component: LiabilityCategoryPage
  },
  {
    path: '/settings',
    name: 'Settings',
    component: SettingsPage
  },
  {
    path: '/statistics',
    name: 'Statistics',
    component: StatisticsPage
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router