import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

/**
 * Loads the AsyncAPI documentation from YAML and returns it as JSON
 * @returns AsyncAPI documentation as a JavaScript object
 */
export function getAsyncApiDocs() {
  try {
    // Try to read the asyncapi.json file first
    const jsonPath = path.join(__dirname, '../../asyncapi.json');
    if (fs.existsSync(jsonPath)) {
      const jsonContent = fs.readFileSync(jsonPath, 'utf8');
      return JSON.parse(jsonContent);
    }

    // Fall back to reading the YAML file
    const yamlPath = path.join(__dirname, '../../asyncapi.yaml');
    if (fs.existsSync(yamlPath)) {
      const yamlContent = fs.readFileSync(yamlPath, 'utf8');
      return YAML.parse(yamlContent);
    }

    throw new Error('AsyncAPI documentation files not found');
  } catch (error) {
    console.error('Error loading AsyncAPI documentation:', error);
    throw error;
  }
}
