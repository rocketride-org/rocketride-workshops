const express = require('express');
const cors = require('cors');
const todos = require('./todos');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// GET /api/todos - return all todos
app.get('/api/todos', (req, res) => {
  res.json(todos.getAll());
});

// POST /api/todos - create a todo
app.post('/api/todos', (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }
  const todo = todos.create(text);
  res.status(201).json(todo);
});

// PATCH /api/todos/:id - update a todo
app.patch('/api/todos/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { text, completed } = req.body;
  const updated = todos.update(id, { text, completed });
  if (!updated) {
    return res.status(404).json({ error: 'Todo not found' });
  }
  res.json(updated);
});

// DELETE /api/todos/:id - delete a todo
app.delete('/api/todos/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const removed = todos.remove(id);
  if (!removed) {
    return res.status(404).json({ error: 'Todo not found' });
  }
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
