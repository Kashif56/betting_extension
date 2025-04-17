// API utilities for the Bot Extension

/**
 * Makes a GET request to the specified URL
 * @param {string} url - The URL to fetch
 * @param {Object} options - Additional fetch options
 * @returns {Promise<any>} - The response data
 */
async function get(url, options = {}) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API GET error:', error);
    throw error;
  }
}

/**
 * Makes a POST request to the specified URL
 * @param {string} url - The URL to fetch
 * @param {Object} data - The data to send
 * @param {Object} options - Additional fetch options
 * @returns {Promise<any>} - The response data
 */
async function post(url, data, options = {}) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: JSON.stringify(data),
      ...options
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API POST error:', error);
    throw error;
  }
}

/**
 * Makes a PUT request to the specified URL
 * @param {string} url - The URL to fetch
 * @param {Object} data - The data to send
 * @param {Object} options - Additional fetch options
 * @returns {Promise<any>} - The response data
 */
async function put(url, data, options = {}) {
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: JSON.stringify(data),
      ...options
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API PUT error:', error);
    throw error;
  }
}

/**
 * Makes a DELETE request to the specified URL
 * @param {string} url - The URL to fetch
 * @param {Object} options - Additional fetch options
 * @returns {Promise<any>} - The response data
 */
async function del(url, options = {}) {
  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API DELETE error:', error);
    throw error;
  }
}

// Export the API functions
export { get, post, put, del };
