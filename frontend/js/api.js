const API_BASE = '/api';

const api = {
  getToken() { return localStorage.getItem('zapp_token'); },
  setToken(t) { localStorage.setItem('zapp_token', t); },
  clearToken() { localStorage.removeItem('zapp_token'); },

  headers() {
    const h = { 'Content-Type': 'application/json' };
    const t = this.getToken();
    if (t) h['Authorization'] = `Bearer ${t}`;
    return h;
  },

  async request(method, path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },
  put(path, body) { return this.request('PUT', path, body); },
  delete(path) { return this.request('DELETE', path); },

  // Auth
  login(email, password) { return this.post('/auth/login', { email, password }); },
  register(data) { return this.post('/auth/register', data); },
  getMe() { return this.get('/auth/me'); },

  // Posts
  createPost(data) { return this.post('/posts', data); },
  getFeed(page=1) { return this.get(`/posts/feed?page=${page}`); },
  getExplore(page=1) { return this.get(`/posts/explore?page=${page}`); },
  deletePost(id) { return this.delete(`/posts/${id}`); },
  likePost(id) { return this.post(`/posts/${id}/like`); },
  getComments(postId) { return this.get(`/posts/${postId}/comments`); },
  addComment(postId, content) { return this.post(`/posts/${postId}/comments`, { content }); },
  deleteComment(postId, commentId) { return this.delete(`/posts/${postId}/comments/${commentId}`); },
  likeComment(postId, commentId) { return this.post(`/posts/${postId}/comments/${commentId}/like`); },

  // Users
  getProfile(username) { return this.get(`/users/${username}`); },
  getUserPosts(username, page=1) { return this.get(`/users/${username}/posts?page=${page}`); },
  updateProfile(data) { return this.put('/users/profile/update', data); },
  followUser(id) { return this.post(`/users/${id}/follow`); },
  unfollowUser(id) { return this.delete(`/users/${id}/follow`); },
  searchUsers(q) { return this.get(`/users/search?q=${encodeURIComponent(q)}`); },
  getSuggestions() { return this.get('/users/suggestions/people'); },
  getFollowers(id) { return this.get(`/users/${id}/followers`); },
  getFollowing(id) { return this.get(`/users/${id}/following`); },
};
