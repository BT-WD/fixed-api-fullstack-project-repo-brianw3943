const apiBaseUrl = 'https://bored-api.appbrewery.com/';
const categoryForm = document.getElementById('categoryForm');
const activityInfo = document.getElementById('activityInfo');

const proxyServices = [
  {
    name: 'AllOrigins raw',
    buildUrl: (target) => `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
    parse: async (response) => {
      const text = await response.text();
      if (!text.trim()) {
        throw new Error('Empty proxy response');
      }
      if (text.trim().startsWith('<') || text.includes('Too many requests') || text.includes('Too many r')) {
        throw new Error('Proxy rate limited');
      }
      return JSON.parse(text);
    },
  },
  {
    name: 'AllOrigins get',
    buildUrl: (target) => `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`,
    parse: async (response) => {
      const text = await response.text();
      if (!text.trim()) {
        throw new Error('Empty proxy response');
      }
      const json = JSON.parse(text);
      const contents = json.contents;
      if (!contents || contents.trim().startsWith('<') || contents.includes('Too many requests') || contents.includes('Too many r')) {
        throw new Error('Proxy rate limited');
      }
      return JSON.parse(contents);
    },
  },
  {
    name: 'Codetabs',
    buildUrl: (target) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`,
    parse: async (response) => {
      const text = await response.text();
      if (!text.trim()) {
        throw new Error('Empty proxy response');
      }
      if (text.trim().startsWith('<') || text.includes('Too many requests') || text.includes('Too many r')) {
        throw new Error('Proxy rate limited');
      }
      return JSON.parse(text);
    },
  },
];

const clearActivityInfo = () => {
  activityInfo.querySelectorAll('div').forEach((node) => {
    node.textContent = '';
  });
};

const cacheBustUrl = (url) => {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}cache_buster=${Date.now()}`;
};

const fetchWithTimeout = (url, options = {}, timeout = 20000) => {
  return Promise.race([
    fetch(url, { cache: 'no-store', ...options }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), timeout)),
  ]);
};

const fetchJsonThroughProxy = async (targetUrl) => {
  let lastError = null;
  const bustUrl = cacheBustUrl(targetUrl);

  for (const service of proxyServices) {
    const proxyUrl = service.buildUrl(bustUrl);
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await fetchWithTimeout(proxyUrl, { mode: 'cors' });
        if (!response.ok) {
          throw new Error(`${service.name} returned HTTP ${response.status}`);
        }
        return await service.parse(response);
      } catch (error) {
        console.warn(`${service.name} attempt ${attempt} failed:`, error);
        lastError = error;
        if (attempt === 2) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }
  }

  throw lastError;
}

const displayLoading = () => {
  clearActivityInfo();
  document.getElementById('activity').textContent = 'Loading activity...';
};

const displayError = (message) => {
  clearActivityInfo();
  const errorDiv = document.createElement('div');
  errorDiv.id = 'activityError';
  const userMessage = message.includes('Proxy rate limited')
    ? 'The proxy is busy or rate limited. Please try again in a few seconds.'
    : message;
  errorDiv.textContent = userMessage;
  errorDiv.style.color = '#ffb3b3';
  activityInfo.appendChild(errorDiv);
};

const displayActivity = (data, selectedCategory) => {
  clearActivityInfo();

  if (!data || data.error) {
    displayError(data?.error || 'No activity available for that category.');
    return;
  }

  document.getElementById('activity').textContent = `Activity: ${data.activity}`;
  document.getElementById('availability').textContent = `Availability: ${data.availability}`;
  document.getElementById('type').textContent = `Type: ${data.type}`;
  document.getElementById('participants').textContent = `Participants: ${data.participants}`;
  document.getElementById('price').textContent = `Price: ${data.price}`;
  document.getElementById('accessibility').textContent = `Accessibility: ${data.accessibility}`;
  document.getElementById('duration').textContent = `Duration: ${data.duration || 'N/A'}`;
  document.getElementById('kidFriendly').textContent = `Kid friendly: ${data.kidFriendly ? 'Yes' : 'No'}`;
  document.getElementById('key').textContent = `Key: ${data.key}`;

  const linkDiv = document.getElementById('link');
  if (data.link) {
    const linkAnchor = document.createElement('a');
    linkAnchor.href = data.link;
    linkAnchor.target = '_blank';
    linkAnchor.rel = 'noopener noreferrer';
    linkAnchor.textContent = data.link;
    linkDiv.textContent = 'Link: ';
    linkDiv.appendChild(linkAnchor);
  }
};

const getActivities = async (event) => {
  if (event) event.preventDefault();

  if (window.location.protocol === 'file:') {
    displayError('Please run this page from a local server (http://localhost) instead of file://. Try: python3 -m http.server');
    return;
  }

  displayLoading();

  const selectedCategory = document.getElementById('category').value;
  const endpoint = selectedCategory === 'any'
    ? 'random'
    : `filter?type=${selectedCategory}`;
  const urlToFetch = `${apiBaseUrl}${endpoint}`;

  try {
    const jsonResponse = await fetchJsonThroughProxy(urlToFetch);
    let activityData = jsonResponse;
    if (Array.isArray(jsonResponse)) {
      activityData = jsonResponse.length === 0
        ? null
        : jsonResponse[Math.floor(Math.random() * jsonResponse.length)];
    }
    displayActivity(activityData, selectedCategory);
  } catch (error) {
    console.error(error);
    displayError(`Unable to fetch activity. ${error.message}`);
  }
};

categoryForm.addEventListener('submit', getActivities);
getActivities();
