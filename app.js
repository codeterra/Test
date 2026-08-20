const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');

function createApp(dataFile = path.join(__dirname, 'data', 'names.json')) {
  const app = express();

  app.use(express.json());

  async function readNames() {
    try {
      return JSON.parse(await fs.readFile(dataFile, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(path.dirname(dataFile), { recursive: true });
        await fs.writeFile(dataFile, '[]\n');
        return [];
      }
      throw error;
    }
  }

  async function writeNames(names) {
    await fs.writeFile(dataFile, `${JSON.stringify(names, null, 2)}\n`);
  }

  app.get('/name', async (request, response, next) => {
    try {
      response.json({ names: await readNames() });
    } catch (error) {
      next(error);
    }
  });

  app.put('/name', async (request, response, next) => {
    try {
      const { name } = request.body;
      const names = await readNames();

      if (names.includes(name)) {
        return response.status(409).json({ error: 'Name already exists' });
      }

      names.push(name);
      await writeNames(names);
      response.status(201).json({ name });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/name/:name', async (request, response, next) => {
    try {
      const names = await readNames();
      const index = names.indexOf(request.params.name);
      const { name } = request.body;

      if (index === -1) {
        return response.status(404).json({ error: 'Name not found' });
      }

      if (names.includes(name)) {
        return response.status(409).json({ error: 'Name already exists' });
      }

      names[index] = name;
      await writeNames(names);
      response.json({ name });
    } catch (error) {
      next(error);
    }
  });

  app.use((error, request, response, next) => {
    response.status(500).json({ error: 'Unable to read names' });
  });

  return app;
}

module.exports = { createApp };
