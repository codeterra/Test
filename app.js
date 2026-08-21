const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');

function createApp(dataFile = path.join(__dirname, 'data', 'names.json')) {
  const app = express();

  app.use(express.json());

  async function readNames() {
    try {
      return JSON.parse(await fs.readFile(dataFile, 'utf8')).map((entry) => (
        typeof entry === 'string' ? { name: entry } : entry
      ));
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
      const { name, age } = request.body;
      const names = await readNames();

      if (names.some((entry) => entry.name === name)) {
        return response.status(409).json({ error: 'Name already exists' });
      }

      const entry = age === undefined ? { name } : { name, age };
      names.push(entry);
      await writeNames(names);
      response.status(201).json(entry);
    } catch (error) {
      next(error);
    }
  });

  app.patch('/name/:name', async (request, response, next) => {
    try {
      const names = await readNames();
      const index = names.findIndex((entry) => entry.name === request.params.name);
      const { name, age } = request.body;

      if (index === -1) {
        return response.status(404).json({ error: 'Name not found' });
      }

      if (name !== undefined && names.some((entry) => entry.name === name)) {
        return response.status(409).json({ error: 'Name already exists' });
      }

      names[index] = {
        ...names[index],
        ...(name === undefined ? {} : { name }),
        ...(age === undefined ? {} : { age })
      };
      await writeNames(names);
      response.json(names[index]);
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
