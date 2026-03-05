/**
 * Service to interact with GitHub API
 */

const BASE_URL = 'https://api.github.com';

/**
 * Parses a GitHub URL to extract the username
 * @param {string} url 
 * @returns {string|null}
 */
export const parseGitHubUrl = (url) => {
  try {
    const cleanUrl = url.trim().replace(/\/$/, '');
    const urlObj = new URL(cleanUrl);

    if (urlObj.hostname !== 'github.com') return null;

    const paths = urlObj.pathname.split('/').filter(p => p);
    if (paths.length === 0) return null;

    // For profile URLs: github.com/username
    return paths[0];
  } catch (e) {
    return null;
  }
};

/**
 * Helper to fetch file content and parse imports
 */
const fetchAndParseImports = async (owner, repo, path) => {
  try {
    const response = await fetch(`${BASE_URL}/repos/${owner}/${repo}/contents/${path}`);
    if (!response.ok) return [];
    const data = await response.json();
    const content = atob(data.content);

    // Simple regex for JS/TS imports/requires
    const importRegex = /(?:import|require)\s*\(?['"](.*?)['"]/g;
    const imports = [];
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    return imports;
  } catch (e) {
    return [];
  }
};

/**
 * Maps a file path or import path to a layer
 */
const getLayerFromPath = (path) => {
  const p = path.toLowerCase();
  if (p.includes('controller')) return 'controllers';
  if (p.includes('service')) return 'services';
  if (p.includes('repository') || p.includes('repo')) return 'repositories';
  if (p.includes('model') || p.includes('entity')) return 'models';
  if (p.includes('route')) return 'routes';
  if (p.includes('config')) return 'config';
  return 'other';
};

/**
 * Detects the project type based on file paths and presence of certain files.
 */
const detectProjectType = (paths) => {
  const frameworks = [
    { name: 'Express', signals: ['express', 'app.js', 'server.js'] },
    { name: 'Django', signals: ['manage.py', 'settings.py', 'wsgi.py'] },
    { name: 'FastAPI', signals: ['fastapi', 'main.py', 'uvicorn'] },
    { name: 'Spring', signals: ['pom.xml', 'build.gradle', 'SpringApplication'] },
    { name: 'Flask', signals: ['flask', 'app.py'] },
    { name: 'React', signals: ['react', 'App.tsx', 'App.jsx'] },
    { name: 'Vue', signals: ['vue', 'App.vue'] },
    { name: 'NestJS', signals: ['nest-cli', 'main.ts'] }
  ];

  const detectedFrameworks = frameworks
    .filter(fw => fw.signals.some(sig => paths.some(p => p.toLowerCase().includes(sig))))
    .map(fw => fw.name);

  // Indicators for categorical types
  const frontendFound = paths.some(p => p.toLowerCase().includes('frontend') || p.toLowerCase().includes('client') || p.toLowerCase().includes('ui'));
  const backendFound = paths.some(p => p.toLowerCase().includes('backend') || p.toLowerCase().includes('server') || p.toLowerCase().includes('api'));
  const dockerFiles = paths.filter(p => p.toLowerCase().includes('dockerfile')).length;
  const composeFound = paths.some(p => p.toLowerCase().includes('docker-compose'));

  const indicators = [
    {
      type: 'Full-stack',
      condition: frontendFound && backendFound,
      score: (frontendFound && backendFound) ? 0.9 : 0
    },
    {
      type: 'Microservice',
      condition: dockerFiles > 1 || (dockerFiles === 1 && composeFound),
      score: (dockerFiles > 1 || (dockerFiles === 1 && composeFound)) ? 0.8 : 0
    },
    {
      type: 'Backend API',
      condition: backendFound && !frontendFound,
      score: (backendFound && !frontendFound) ? 0.7 : 0
    },
    {
      type: 'ML system',
      signals: ['requirements.txt', 'conda.yml', 'notebooks', 'pytorch', 'tensorflow'],
      score: 0
    },
    {
      type: 'CLI tool',
      signals: ['bin', 'cli', 'scripts', 'argparse', 'click'],
      score: 0
    },
    {
      type: 'Library',
      signals: ['index.d.ts', 'dist', 'lib', 'package.json', 'setup.py'],
      score: 0
    }
  ];

  // Calculate scores for those that didn't have conditions
  indicators.forEach(ind => {
    if (ind.signals) {
      const hits = ind.signals.filter(sig => paths.some(p => p.toLowerCase().includes(sig)));
      ind.score = hits.length / ind.signals.length;
    }
  });

  const top = indicators.reduce((a, b) => a.score > b.score ? a : b);
  const confidence = Math.min(100, Math.round(top.score * 100 + (detectedFrameworks.length * 10)));

  return {
    type: top.type,
    confidence,
    frameworks: detectedFrameworks
  };
};

/**
 * Fetches recent commits for a project.
 */
const fetchCommits = async (owner, repo) => {
  try {
    const response = await fetch(`${BASE_URL}/repos/${owner}/${repo}/commits?per_page=30`);
    return response.ok ? await response.json() : [];
  } catch (error) {
    console.error('Error fetching commits:', error);
    return [];
  }
};

/**
 * Analyzes a project's architecture based on folder structure and dependency flow
 */
export const analyzeProjectArchitecture = async (owner, repo, username) => {
  const metrics = {
    layeredStructure: { score: 0, details: [], max: 10 },
    dependencyRule: { score: 0, details: [], max: 15 },
    modularityCoupling: { score: 0, details: [], max: 10 },
    testCoverage: { score: 0, details: [], max: 15 },
    configDiscipline: { score: 0, details: [], max: 10 },
    containerization: { score: 0, details: [], max: 10 },
    cicdWorkflow: { score: 0, details: [], max: 5 },
    dbDiscipline: { score: 0, details: [], max: 10 },
    documentation: { score: 0, details: [], max: 5 },
    commitDiscipline: { score: 0, details: [], max: 10 }
  };

  try {
    const treeResponse = await fetch(`${BASE_URL}/repos/${owner}/${repo}/git/trees/main?recursive=1`);
    let treeData = treeResponse.ok ? await treeResponse.json() : null;

    if (!treeData) {
      const masterResponse = await fetch(`${BASE_URL}/repos/${owner}/${repo}/git/trees/master?recursive=1`);
      treeData = masterResponse.ok ? await masterResponse.json() : { tree: [] };
    }

    const paths = treeData.tree.map(item => item.path);
    const folders = Array.from(new Set(paths.filter(p => !p.includes('.')).map(p => p.split('/')[0])));
    const functionalFolders = folders.filter(f => !f.startsWith('.'));

    // 1. Layered Structure Presence (10 pts)
    const architecturalLayers = ['controllers', 'services', 'repositories', 'domain', 'infrastructure', 'config', 'models', 'api', 'routes'];
    const foundLayers = architecturalLayers.filter(layer => paths.some(p => p.toLowerCase().includes(layer)));
    if (foundLayers.length >= 3 || functionalFolders.length > 3) {
      metrics.layeredStructure.score = 10;
      metrics.layeredStructure.details.push(`Clean separation: Found ${foundLayers.length} architectural layers`);
    } else if (foundLayers.length > 0) {
      metrics.layeredStructure.score = 5;
      metrics.layeredStructure.details.push('Partial separation: Minimal layering detected');
    } else {
      metrics.layeredStructure.score = 0;
      metrics.layeredStructure.details.push('Flat structure detected: Most files in root or undifferentiated folders');
    }

    // 2. Dependency Rule Compliance (15 pts)
    let violations = 0;
    let circular = 0; // Circular detection is hard via regex, we'll use same-layer loops as proxy
    const layersToSample = ['controllers', 'services', 'repositories'];
    for (const layer of layersToSample) {
      const file = treeData.tree.find(item => item.path.toLowerCase().includes(layer) && (item.path.endsWith('.js') || item.path.endsWith('.ts')));
      if (file) {
        const imports = await fetchAndParseImports(owner, repo, file.path);
        imports.forEach(imp => {
          const target = getLayerFromPath(imp);
          if (layer === 'controllers' && target === 'repositories') violations++;
          if (layer === 'services' && target === 'controllers') violations++;
          if (layer === 'repositories' && (target === 'controllers' || target === 'services')) violations++;
          if (target === layer) circular++; // Proxy for complexity
        });
      }
    }
    metrics.dependencyRule.score = Math.max(0, 15 - (circular * 2) - (violations * 3));
    metrics.dependencyRule.details.push(violations === 0 ? 'Strict dependency flow' : `Detected ${violations} illegal cross-layer imports`);

    // 3. Modularity & Coupling Index (10 pts)
    const avgCoupling = functionalFolders.length > 0 ? paths.length / functionalFolders.length : paths.length;
    metrics.modularityCoupling.score = Math.min(10, Math.round(10 - (avgCoupling > 50 ? 5 : 0)));
    metrics.modularityCoupling.details.push(`Modularity index: ${functionalFolders.length} functional modules`);

    // 4. Test Coverage & Presence (15 pts)
    const testPatterns = ['test', 'spec', '__tests__', 'unit', 'e2e'];
    const testFiles = paths.filter(p => testPatterns.some(pat => p.toLowerCase().includes(pat)));
    const coverageRatio = testFiles.length / (paths.length || 1);
    if (testFiles.length > 10 || coverageRatio > 0.1) {
      metrics.testCoverage.score = 15;
      metrics.testCoverage.details.push('Excellent test presence detected');
    } else if (testFiles.length > 0) {
      metrics.testCoverage.score = 8;
      metrics.testCoverage.details.push('Basic test presence detected');
    } else {
      metrics.testCoverage.score = 0;
      metrics.testCoverage.details.push('No tests found in repository');
    }

    // 5. Configuration Discipline (10 pts)
    const hasEnvExample = paths.some(p => p.includes('.env.example') || p.includes('config.example') || p.includes('.env.template'));
    const usesConfig = paths.some(p => p.includes('config/') || p.includes('settings.py') || p.includes('application.properties'));
    metrics.configDiscipline.score = (hasEnvExample ? 5 : 0) + (usesConfig ? 5 : 0);
    metrics.configDiscipline.details.push(hasEnvExample ? 'Environment template provided' : 'Missing .env.example');

    // 6. Containerization (10 pts)
    const hasDockerfile = paths.some(p => p.toLowerCase().includes('dockerfile'));
    const hasCompose = paths.some(p => p.toLowerCase().includes('docker-compose'));
    metrics.containerization.score = (hasDockerfile ? 5 : 0) + (hasCompose ? 5 : 0);
    metrics.containerization.details.push(hasDockerfile ? 'Dockerized: Portability maintained' : 'No containerization found');

    // 7. CI/CD Workflow Presence (5 pts)
    const hasHasActions = paths.some(p => p.includes('.github/workflows'));
    metrics.cicdWorkflow.score = hasHasActions ? 5 : 0;
    metrics.cicdWorkflow.details.push(hasHasActions ? 'GitHub Actions active' : 'No automated pipelines found');

    // 8. Database & Index Discipline (10 pts)
    const migrationPatterns = ['migration', 'alembic', 'flyway', 'liquibase', 'schema.sql'];
    const hasMigrations = paths.some(p => migrationPatterns.some(pat => p.toLowerCase().includes(pat)));
    const ormSignals = ['prisma', 'typeorm', 'sequelize', 'hibernate', 'eloquent', 'mongoose'];
    const hasORM = paths.some(p => ormSignals.some(pat => p.toLowerCase().includes(pat)));
    metrics.dbDiscipline.score = (hasMigrations ? 5 : 0) + (hasORM ? 5 : 0);
    metrics.dbDiscipline.details.push(hasMigrations ? 'Structured database migrations found' : 'Basic or no database structure detected');

    // 9. Documentation & Architecture Explanation (5 pts)
    const readme = paths.find(p => p.toLowerCase() === 'readme.md');
    let docBonus = 0;
    if (readme) {
      // Heuristic: check readme for architecture keywords
      docBonus = paths.some(p => p.includes('docs/') || p.includes('architecture.md')) ? 2 : 0;
    }
    metrics.documentation.score = Math.min(5, (readme ? 3 : 0) + docBonus);
    metrics.documentation.details.push(readme ? 'README present with technical docs' : 'Missing documentation');

    // 10. Commit Discipline & Evolution (10 pts)
    const commits = await fetchCommits(owner, repo);
    const uniqueDays = new Set(commits.map(c => c.commit.author.date.split('T')[0])).size;
    if (uniqueDays > 5) {
      metrics.commitDiscipline.score = 10;
      metrics.commitDiscipline.details.push('Healthy evolutionary history: Multi-day progression');
    } else if (commits.length > 5) {
      metrics.commitDiscipline.score = 5;
      metrics.commitDiscipline.details.push('Moderate history: Short-term development burst');
    } else {
      metrics.commitDiscipline.score = 0;
      metrics.commitDiscipline.details.push('One-shot upload or extremely low activity detected');
    }

    const total = Object.values(metrics).reduce((sum, m) => sum + m.score, 0);

    return {
      metrics,
      total,
      projectType: detectProjectType(paths)
    };
  } catch (error) {
    console.error('Error analyzing architecture:', error);
    return { total: 0, error: 'Analysis failed' };
  }
};

/**
 * Fetches repositories for a given username
 * @param {string} username 
 * @returns {Promise<Array>}
 */
export const fetchUserProjects = async (username) => {
  try {
    // 1. Fetch owned repositories
    const reposResponse = await fetch(`${BASE_URL}/users/${username}/repos?sort=updated&per_page=10`);
    if (!reposResponse.ok) {
      throw new Error(`User not found or API limit reached: ${reposResponse.status}`);
    }
    const ownedRepos = await reposResponse.json();

    // 2. Fetch public activity events to find collaborations
    const eventsResponse = await fetch(`${BASE_URL}/users/${username}/events/public?per_page=30`);
    const events = eventsResponse.ok ? await eventsResponse.json() : [];

    const projectMap = new Map();

    // Add owned repos
    ownedRepos.forEach(repo => {
      projectMap.set(repo.full_name, {
        name: repo.full_name,
        url: repo.html_url,
        isOwner: true,
        owner: repo.owner.login,
        repo: repo.name
      });
    });

    // Add repositories from events (PullRequestEvent, PushEvent etc. on other repos)
    events.forEach(event => {
      if (event.repo && event.repo.name && !projectMap.has(event.repo.name)) {
        projectMap.set(event.repo.name, {
          name: event.repo.name,
          url: `https://github.com/${event.repo.name}`,
          isOwner: false,
          owner: event.repo.name.split('/')[0],
          repo: event.repo.name.split('/')[1]
        });
      }
    });

    // Convert to array and limit to 12 projects for demo performance
    const projectsToAnalyze = Array.from(projectMap.values()).slice(0, 12);

    // 3. Analyze architecture for all projects
    const projectPromises = projectsToAnalyze.map(async (project) => {
      const arch = await analyzeProjectArchitecture(project.owner, project.repo, username);
      return {
        ...project,
        archScore: arch.total,
        archDetails: arch
      };
    });

    return await Promise.all(projectPromises);
  } catch (error) {
    console.error('Error fetching GitHub projects:', error);
    throw error;
  }
};
