const https = require('https');

const RAILWAY_API_TOKEN = '991b2bb6-aeaf-43e7-8753-62d1ea4c1366';

function graphqlRequest(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, variables });
    const options = {
      hostname: 'backboard.railway.app',
      port: 443,
      path: '/graphql/v2',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RAILWAY_API_TOKEN}`,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (result.errors) {
            reject(new Error(JSON.stringify(result.errors)));
          } else {
            resolve(result.data);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  try {
    // 1. 获取项目列表
    const projectsData = await graphqlRequest(`
      query GetProjects {
        me {
          projects {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      }
    `);

    console.log('Projects found:');
    console.dir(projectsData, { depth: null });

    if (projectsData?.me?.projects?.edges?.length > 0) {
      const projectId = projectsData.me.projects.edges[0].node.id;
      console.log(`\nUsing project: ${projectsData.me.projects.edges[0].node.name} (ID: ${projectId})`);

      // 2. 获取项目的环境变量
      const variablesData = await graphqlRequest(`
        query GetVariables($projectId: String!) {
          project(id: $projectId) {
            environments {
              edges {
                node {
                  id
                  name
                  variables
                }
              }
            }
          }
        }
      `, { projectId });

      console.log('\nEnvironment variables:');
      console.dir(variablesData, { depth: null });
    }

  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();