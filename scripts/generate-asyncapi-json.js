#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

// Paths
const yamlPath = path.join(__dirname, '../asyncapi.yaml');
const jsonPath = path.join(__dirname, '../asyncapi.json');

try {
  // Read YAML file
  console.log(`Reading AsyncAPI YAML from ${yamlPath}`);
  const yamlContent = fs.readFileSync(yamlPath, 'utf8');

  // Parse YAML to JavaScript object
  const asyncApiDocs = YAML.parse(yamlContent);

  // Convert to JSON and write to file
  const jsonContent = JSON.stringify(asyncApiDocs, null, 2);
  fs.writeFileSync(jsonPath, jsonContent);

  console.log(`AsyncAPI JSON file generated at ${jsonPath}`);
} catch (error) {
  console.error('Error generating AsyncAPI JSON:', error);
  process.exit(1);
}
