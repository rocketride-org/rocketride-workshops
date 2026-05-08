// server/todos.js — In-memory store + route handlers

let todos = [];
let nextId = 1;

function list(req, res) {
  res.json(todos);
}

function create(req, res) {
  const { text } = req.body;
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return res.status(400).json({ error: 'text is required' });
  }
  const todo = { id: nextId++, text: text.trim(), completed: false };
  todos.push(todo);
  res.status(201).json(todo);
}

function update(req, res) {
  const id = Number(req.params.id);
  const todo = todos.find((t) => t.id === id);
  if (!todo) {
    return res.status(404).json({ error: 'todo not found' });
  }
  if (req.body.completed !== undefined) {
    todo.completed = Boolean(req.body.completed);
  }
  res.json(todo);
}

function remove(req, res) {
  const id = Number(req.params.id);
  const idx = todos.findIndex((t) => t.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'todo not found' });
  }
  todos.splice(idx, 1);
  res.json({ ok: true });
}

module.exports = { list, create, update, remove };
