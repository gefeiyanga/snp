import { createApp } from 'vue'
import { setToastDefaultOptions } from 'vant'
import 'vant/es/toast/style'
import App from './App.vue'
import router from './router'
import './styles/global.less'

setToastDefaultOptions({
  position: 'top',
  className: 'finance-toast'
})

const app = createApp(App)

app.use(router)
app.mount('#app')
