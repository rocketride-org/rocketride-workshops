// server/index.js — Express entry, starts server on :3001

const express = require('express');
const { list, create, update, remove } = require('./todos');

const app = express();
const PORT = 3001;

app.use(express.json());

app.get('/todos', list);
app.post('/todos', create);
app.patch('/todos/:id', update);
app.delete('/todos/:id', remove);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
