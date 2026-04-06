import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import HeroBanner from './HeroBanner.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'home-features-before': () => h(HeroBanner),
    })
  },
}
