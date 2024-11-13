<template>
  <div id="app">
    <DataComparison />
  </div>
</template>

<script>
import DataComparison from './components/DataComparison.vue'

export default {
  name: 'App',
  components: {
    DataComparison
  }
}
</script>

<style>
#app {
  font-family: Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style> 