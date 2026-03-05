<template>
  <div class="container animate-fade-in">
    <header class="header">
      <div class="logo-container">
        <svg class="github-icon" viewBox="0 0 24 24" width="64" height="64">
          <path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
        </svg>
      </div>
      <h1 class="title">Collaborator <span class="accent">Finder</span></h1>
      <p class="subtitle">Discover projects your favorite developers contribute to.</p>
    </header>

    <main class="main-content">
      <div class="input-card glass-morphism">
        <label for="github-url" class="input-label">GitHub Profile URL</label>
        <div class="search-group">
          <div class="input-wrapper">
            <span class="url-prefix">github.com/</span>
            <input 
              type="text" 
              id="github-url" 
              v-model="inputUrl" 
              placeholder="username" 
              @keyup.enter="checkProjects"
              :disabled="loading"
            />
          </div>
          <button @click="checkProjects" :disabled="loading" class="check-btn">
            <span v-if="!loading">Explore</span>
            <div v-else class="loader"></div>
          </button>
        </div>
        <p v-if="error" class="error-msg">{{ error }}</p>
      </div>

      <div v-if="projects.length > 0" class="results-container">
        <h2 class="results-title">Collaborations Found <span class="count">({{ projects.length }})</span></h2>
        <div class="projects-grid">
          <div 
            v-for="(project, index) in projects" 
            :key="index" 
            class="project-card glass-morphism animate-fade-in"
            :style="{ animationDelay: `${index * 50}ms` }"
            @click="selectedProject = project"
          >
            <div class="project-info">
              <h3 class="repo-name">{{ project.name.split('/')[1] }}</h3>
              <p class="repo-owner">{{ project.name.split('/')[0] }}</p>
              <div class="tags">
                <span v-if="project.isOwner" class="tag owner">Owner</span>
                <span v-else class="tag collaborator">Collaborator</span>
                <span v-if="project.archDetails.projectType" class="tag type">
                  {{ project.archDetails.projectType.type }} ({{ project.archDetails.projectType.confidence }}%)
                </span>
                <span :class="['tag', 'score', getScoreClass(project.archScore)]">
                  Arch: {{ project.archScore }}/100
                </span>
              </div>
            </div>
            <div class="card-actions">
              <a :href="project.url" target="_blank" class="view-btn" @click.stop>
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path fill="currentColor" d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Detail Modal -->
      <div v-if="selectedProject" class="modal-overlay" @click="selectedProject = null">
        <div class="modal-content glass-morphism animate-fade-in" @click.stop>
          <header class="modal-header">
            <h3>{{ selectedProject.name }}</h3>
            <button class="close-btn" @click="selectedProject = null">&times;</button>
          </header>
          
          <div class="modal-body">
            <div class="overall-score">
              <span class="score-label">Architecture Discipline Score</span>
              <span :class="['score-value', getScoreClass(selectedProject.archScore)]">
                {{ selectedProject.archScore }}<span>/100</span>
              </span>
            </div>

            <div class="project-type-banner" v-if="selectedProject.archDetails.projectType">
              <div class="type-main">
                <span class="type-label">Detected Nature:</span>
                <span class="type-value">{{ selectedProject.archDetails.projectType.type }}</span>
                <div class="framework-pills" v-if="selectedProject.archDetails.projectType.frameworks.length">
                  <span v-for="fw in selectedProject.archDetails.projectType.frameworks" :key="fw" class="fw-pill">
                    {{ fw }}
                  </span>
                </div>
              </div>
              <div class="confidence-section">
                <div class="confidence-bar">
                  <div class="confidence-fill" :style="{ width: selectedProject.archDetails.projectType.confidence + '%' }"></div>
                </div>
                <span class="confidence-text">{{ selectedProject.archDetails.projectType.confidence }}% Confidence</span>
              </div>
            </div>

            <div class="score-breakdown-grid">
              <div v-for="(metric, key) in selectedProject.archDetails.metrics" :key="key" class="metric-card glass-morphism">
                <div class="metric-header">
                  <h5>{{ formatMetricName(key) }}</h5>
                  <span :class="['metric-score', getMetricClass(metric.score, metric.max)]">
                    {{ metric.score }}/{{ metric.max }}
                  </span>
                </div>
                <div class="metric-progress">
                  <div class="progress-fill" :style="{ width: (metric.score / metric.max * 100) + '%' }"></div>
                </div>
                <ul class="metric-details">
                  <li v-for="detail in metric.details" :key="detail">{{ detail }}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="searched && !loading && projects.length === 0" class="empty-state">
        <p>No collaborations found for this user.</p>
      </div>
    </main>
    
    <footer class="footer">
      <p>Building with &hearts; at CodeX Hackathon</p>
    </footer>
  </div>
</template>

<script>
import { parseGitHubUrl, fetchUserProjects } from './services/githubService'

export default {
  name: 'App',
  data() {
    return {
      inputUrl: '',
      loading: false,
      error: '',
      projects: [],
      searched: false,
      selectedProject: null
    }
  },
  methods: {
    getScoreClass(score) {
      if (score >= 80) return 'score-high';
      if (score >= 50) return 'score-med';
      return 'score-low';
    },
    getMetricClass(score, max) {
      const ratio = score / max;
      if (ratio >= 0.8) return 'metric-high';
      if (ratio >= 0.5) return 'metric-med';
      return 'metric-low';
    },
    formatMetricName(key) {
      return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .replace('Ci Cd', 'CI/CD')
        .replace('Db', 'DB');
    },
    async checkProjects() {
      if (!this.inputUrl) {
        this.error = 'Please enter a GitHub URL or username'
        return
      }

      this.loading = true
      this.error = ''
      this.projects = []
      this.searched = false

      try {
        // Handle both full URLs and just usernames
        let username = this.inputUrl
        if (this.inputUrl.includes('github.com')) {
          username = parseGitHubUrl(this.inputUrl)
        }
        
        if (!username) {
          throw new Error('Invalid GitHub URL')
        }

        const data = await fetchUserProjects(username)
        this.projects = data
        this.searched = true
      } catch (err) {
        this.error = err.message || 'Something went wrong. Please try again.'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.container {
  width: 100%;
  padding-top: 4rem;
}

.header {
  text-align: center;
  margin-bottom: 4rem;
}

.logo-container {
  display: inline-block;
  padding: 1.5rem;
  background: linear-gradient(135deg, var(--primary), #818cf8);
  border-radius: 2rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.5);
  transition: transform 0.3s ease;
}

.logo-container:hover {
  transform: scale(1.05) rotate(5deg);
}

.github-icon {
  color: white;
}

.title {
  font-size: 3.5rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  margin-bottom: 0.5rem;
}

.accent {
  background: linear-gradient(to right, #6366f1, #a855f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  font-size: 1.25rem;
  color: var(--text-secondary);
}

.main-content {
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.input-card {
  padding: 2.5rem;
  margin-bottom: 3rem;
}

.input-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  margin-bottom: 1rem;
}

.search-group {
  display: flex;
  gap: 1rem;
}

.input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid var(--glass-border);
  border-radius: 1rem;
  padding: 0 1.25rem;
  transition: all 0.3s ease;
}

.input-wrapper:focus-within {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.url-prefix {
  color: var(--text-secondary);
  font-weight: 500;
  margin-right: 0.25rem;
}

input {
  background: transparent;
  border: none;
  color: white;
  font-family: inherit;
  font-size: 1.125rem;
  padding: 1rem 0;
  width: 100%;
  outline: none;
}

.check-btn {
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 1rem;
  padding: 0 2rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 120px;
}

.check-btn:hover:not(:disabled) {
  background: var(--primary-hover);
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.4);
}

.check-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.loader {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-msg {
  color: var(--error);
  margin-top: 1rem;
  font-size: 0.875rem;
}

.results-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.count {
  background: rgba(99, 102, 241, 0.1);
  color: var(--primary);
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 1rem;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.project-card {
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.project-card:hover {
  border-color: var(--primary);
  transform: translateY(-4px);
  background: rgba(30, 41, 59, 0.9);
}

.repo-owner {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.tag.score {
  border: 1px solid currentColor;
  background: transparent;
}

.score-high { color: var(--success); }
.score-med { color: var(--primary); }
.score-low { color: var(--error); }

.project-card {
  cursor: pointer;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(8px);
}

.modal-content {
  width: 90%;
  max-width: 600px;
  padding: 2.5rem;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 2rem;
  cursor: pointer;
}

.overall-score {
  text-align: center;
  margin-bottom: 2.5rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--glass-border);
}

.score-label {
  display: block;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.score-value {
  font-size: 4rem;
  font-weight: 800;
}

.score-value span {
  font-size: 1.5rem;
  opacity: 0.5;
}

.breakdown-item {
  margin-bottom: 2rem;
}

.item-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.item-header h4 {
  font-size: 1.125rem;
  font-weight: 600;
}

ul {
  list-style: none;
}

li {
  position: relative;
  padding-left: 1.5rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
  font-size: 0.9375rem;
}

li::before {
  content: "•";
  position: absolute;
  left: 0;
  color: var(--primary);
  font-weight: bold;
}

.tag.type {
  background: rgba(168, 85, 247, 0.1);
  color: #a855f7;
  border: 1px solid rgba(168, 85, 247, 0.3);
}

.project-type-banner {
  background: rgba(99, 102, 241, 0.05);
  border: 1px solid var(--glass-border);
  border-radius: 1rem;
  padding: 1.5rem;
  margin-bottom: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.type-main {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.type-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.type-value {
  font-size: 1.125rem;
  font-weight: 700;
  color: #a855f7;
}

.framework-pills {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.fw-pill {
  background: rgba(99, 102, 241, 0.1);
  color: var(--primary);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.6rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.confidence-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.confidence-bar {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.confidence-fill {
  height: 100%;
  background: linear-gradient(to right, #6366f1, #a855f7);
  border-radius: 3px;
  transition: width 1s ease-out;
}

.confidence-text {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.score-breakdown-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1.25rem;
  margin-top: 2rem;
}

.metric-card {
  padding: 1.25rem;
  background: rgba(15, 23, 42, 0.3) !important;
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.metric-header h5 {
  font-size: 0.9375rem;
  font-weight: 700;
  color: white;
}

.metric-score {
  font-size: 0.75rem;
  font-weight: 800;
  padding: 0.2rem 0.5rem;
  border-radius: 0.4rem;
  background: rgba(255, 255, 255, 0.05);
}

.metric-high { color: var(--success); }
.metric-med { color: var(--primary); }
.metric-low { color: var(--error); }

.metric-progress {
  height: 4px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 2px;
  margin-bottom: 1rem;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: currentColor;
  border-radius: 2px;
  transition: width 0.6s ease;
}

.metric-details {
  list-style: none;
  padding: 0;
}

.metric-details li {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.4;
  margin-bottom: 0.4rem;
  padding-left: 1rem;
}

.metric-details li::before {
  font-size: 0.75rem;
  left: 0;
  top: 1px;
}
</style>
