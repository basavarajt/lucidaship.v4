import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const client = axios.create({
  baseURL: API_URL,
});

// Optional bearer token support (for Firebase-integrated deployments)
client.interceptors.request.use(
  (config) => {
    let guestSessionId = sessionStorage.getItem('guest_session_id');
    if (!guestSessionId) {
      guestSessionId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem('guest_session_id', guestSessionId);
    }
    config.headers['X-Guest-Session-ID'] = guestSessionId;

    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (!(config.data instanceof FormData)) {
      config.headers['Content-Type'] = config.headers['Content-Type'] || 'application/json';
    } else {
      if (typeof config.headers.delete === 'function') {
        config.headers.delete('Content-Type');
        config.headers.delete('content-type');
      } else {
        delete config.headers['Content-Type'];
        delete config.headers['content-type'];
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export const authApi = {
  me: async () => {
    const response = await client.get('/auth/me');
    return response.data;
  },
};

export const scoringApi = {
  appendCsvFiles: (formData, files) => {
    files.forEach((file) => formData.append('files', file, file.name));
    if (files.length === 1) {
      formData.append('file', files[0], files[0].name);
    }
  },

  mergePlan: async (files) => {
    const formData = new FormData();
    scoringApi.appendCsvFiles(formData, files);

    const response = await client.post('/merge-plan', formData);
    return response.data;
  },

  // ━━ SYNC TRAINING (legacy, still works) ━━
  train: async (modelName, files, targetCol = null, mode = "supervised") => {
    const formData = new FormData();
    scoringApi.appendCsvFiles(formData, files);

    let url = `/train?model_name=${encodeURIComponent(modelName)}&mode=${encodeURIComponent(mode)}`;
    if (targetCol) url += `&target_column=${encodeURIComponent(targetCol)}`;

    const response = await client.post(url, formData);
    return response.data;
  },

  // ━━ ASYNC TRAINING (NEW - Production Ready) ━━
  /**
   * Start background training job. Returns immediately with job_id.
   * @param {string} modelName - Model name
   * @param {File[]} files - CSV files to train on
   * @param {string} targetCol - Binary target column name (optional for auto-detect)
   * @param {string} mode - 'supervised' (default) or 'unsupervised'
   * @returns {Promise} {job_id, status, message, poll_url, result_url}
   */
  trainAsync: async (modelName, files, targetCol = null, mode = "supervised") => {
    const formData = new FormData();
    scoringApi.appendCsvFiles(formData, files);

    let url = `/train/async?model_name=${encodeURIComponent(modelName)}&mode=${encodeURIComponent(mode)}`;
    if (targetCol) url += `&target_column=${encodeURIComponent(targetCol)}`;

    const response = await client.post(url, formData);
    return response.data;
  },

  /**
   * Poll for training job status. Call this every 3-5 seconds.
   * @param {string} jobId - Job ID from trainAsync
   * @returns {Promise} Job status, progress (0-100), current_step, etc.
   */
  getTrainingStatus: async (jobId) => {
    const response = await client.get(`/train/status/${encodeURIComponent(jobId)}`);
    return response.data;
  },

  /**
   * Get final training results (call when status = 'completed').
   * @param {string} jobId - Job ID from trainAsync
   * @returns {Promise} Final metrics, model info, results
   */
  getTrainingResult: async (jobId) => {
    const response = await client.get(`/train/${encodeURIComponent(jobId)}/result`);
    return response.data;
  },

  /**
   * List all training jobs for current user.
   * @param {number} limit - Max jobs to return (default 50)
   * @returns {Promise} List of jobs
   */
  listTrainingJobs: async (limit = 50) => {
    const response = await client.get(`/train/jobs?limit=${limit}`);
    return response.data;
  },

  score: async (modelName, files, autoSelectModel = false) => {
    const formData = new FormData();
    scoringApi.appendCsvFiles(formData, files);

    const url =
      `/score-csv?model_name=${encodeURIComponent(modelName)}&auto_select_model=${encodeURIComponent(autoSelectModel)}`;
    const response = await client.post(url, formData);
    return response.data;
  },

  listRankedLists: async () => {
    const response = await client.get('/ranked-lists');
    return response.data;
  },

  getRankedList: async (runId) => {
    const response = await client.get(`/ranked-lists/${encodeURIComponent(runId)}`);
    return response.data;
  },

  feedback: async (modelName, file, outcomeColumn = null, autoRetrain = false, feedbackWeight = 2) => {
    const formData = new FormData();
    formData.append('file', file);

    let url = `/feedback?model_name=${encodeURIComponent(modelName)}`;
    if (outcomeColumn) url += `&outcome_column=${encodeURIComponent(outcomeColumn)}`;
    url += `&auto_retrain=${encodeURIComponent(autoRetrain)}`;
    url += `&feedback_weight=${encodeURIComponent(feedbackWeight)}`;

    const response = await client.post(url, formData);
    return response.data;
  },

  retrainFromFeedback: async (modelName, feedbackWeight = 2) => {
    const url = `/retrain-from-feedback?model_name=${encodeURIComponent(modelName)}&feedback_weight=${encodeURIComponent(feedbackWeight)}`;
    const response = await client.post(url);
    return response.data;
  },
  retrainSegmentFromFeedback: async (modelName, segmentDimension, segmentValue, feedbackWeight = 2) => {
    const url = `/retrain-segment-feedback?model_name=${encodeURIComponent(modelName)}&segment_dimension=${encodeURIComponent(segmentDimension)}&segment_value=${encodeURIComponent(segmentValue)}&feedback_weight=${encodeURIComponent(feedbackWeight)}`;
    const response = await client.post(url);
    return response.data;
  },
};

export const modelsApi = {
  list: async () => {
    const response = await client.get('/models');
    return response.data;
  },
  get: async (modelName) => {
    const response = await client.get(`/models/${encodeURIComponent(modelName)}`);
    return response.data;
  },
  delete: async (modelName) => {
    const response = await client.delete(`/models/${encodeURIComponent(modelName)}`);
    return response.data;
  },
};

export default client;
