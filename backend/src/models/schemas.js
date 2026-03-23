/**
 * @typedef {Object} Node
 * @property {string} id
 * @property {string} label
 * @property {string} type
 * @property {Object} metadata
 */

/**
 * @typedef {Object} Edge
 * @property {string} id
 * @property {string} source
 * @property {string} target
 * @property {string} type
 */

/**
 * @typedef {Object} GraphData
 * @property {Node[]} nodes
 * @property {Edge[]} edges
 */

/**
 * @typedef {Object} ChatRequest
 * @property {string} message
 */

/**
 * @typedef {Object} ChatResponse
 * @property {string} answer
 * @property {string|null} sql
 * @property {Object[]|null} data
 * @property {string[]|null} relatedNodeIds
 * @property {string|null} api_key_used
 * @property {boolean|null} fallback_used
 * @property {boolean|null} cached
 */

// Since this is JavaScript, these are primarily for documentation/intellisense.
// In a more complex 앱, we might use a library like Joi or Zod for runtime validation.

module.exports = {};
