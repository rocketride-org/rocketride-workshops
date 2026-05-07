// In-memory CRUD store for todos

let todos = [];
let nextId = 1;

function getAll() {
  return todos;
}

function getById(id) {
  return todos.find((todo) => todo.id === id);
}

function create(text) {
  const todo = { id: nextId++, text, completed: false };
  todos.push(todo);
  return todo;
}

function update(id, changes) {
  const todo = todos.find((t) => t.id === id);
  if (!todo) return null;
  if (changes.text !== undefined) todo.text = changes.text;
  if (changes.completed !== undefined) todo.completed = changes.completed;
  return todo;
}

function remove(id) {
  const index = todos.findIndex((t) => t.id === id);
  if (index === -1) return false;
  todos.splice(index, 1);
  return true;
}

module.exports = { getAll, getById, create, update, remove };
