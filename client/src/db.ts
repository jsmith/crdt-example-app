import { Timestamp } from "./shared/timestamp";
import * as uuid from "uuid";
import { sendMessages } from "./sync";
import { getClock } from "./clock";

export type TodoColor =
  | "green"
  | "blue"
  | "red"
  | "orange"
  | "yellow"
  | "teal"
  | "purple"
  | "pink";

export type Todo = {
  id: string;
  name: string;
  type: { name: string; color: TodoColor } | null;
  tombstone?: 1;
  order: number;
};

export type TodoType = {
  id: string;
  name: string;
  color: TodoColor;
  tombstone?: 1;
};

export type TodoTypeMapping = {
  id: string;
  targetId: string;
};

export type Message<
  K extends DataKeys = any,
  C extends Data[K] & string = any
> = {
  dataset: K;
  row: string;
  column: C;
  value: TODO;
  timestamp: string;
};

export let _messages: Message[] = [];

export let _data: {
  todos: Todo[];
  todoTypes: TodoType[];
  todoTypeMapping: TodoTypeMapping[];
} = {
  todos: [],
  todoTypes: [],
  todoTypeMapping: [],
};

export type Data = typeof _data;

export type DataKeys = keyof Data;

type TODO = any;

export function insert(table: string, row: TODO) {
  let id = uuid.v4();
  let fields = Object.keys(row);

  sendMessages(
    fields.map((k) => {
      return {
        dataset: table,
        row: row.id || id,
        column: k,
        value: row[k],
        timestamp: Timestamp.send(getClock()).toString(),
      };
    })
  );

  return id;
}

export function update(table: TODO, params: TODO) {
  let fields = Object.keys(params).filter((k) => k !== "id");

  sendMessages(
    fields.map((k) => {
      return {
        dataset: table,
        row: params.id,
        column: k,
        value: params[k],
        timestamp: Timestamp.send(getClock()).toString(),
      };
    })
  );
}

export function delete_(table: TODO, id: string) {
  sendMessages([
    {
      dataset: table,
      row: id,
      column: "tombstone",
      value: 1,
      timestamp: Timestamp.send(getClock()).toString(),
    },
  ]);
}

function _resolveTodos(todos: Todo[]) {
  todos = todos.map((todo) => ({
    ...todo,
    type: todo.type ? getTodoType(todo.type) : null,
  }));

  todos.sort((t1, t2) => {
    if (t1.order < t2.order) {
      return 1;
    } else if (t1.order > t2.order) {
      return -1;
    }
    return 0;
  });

  return todos;
}

export function getTodos() {
  return _resolveTodos(_data.todos.filter((todo) => todo.tombstone !== 1));
}

export function getDeletedTodos() {
  return _resolveTodos(_data.todos.filter((todo) => todo.tombstone === 1));
}

export function getAllTodos() {
  return _resolveTodos(_data.todos);
}

export function getTodoType(id: TODO) {
  // Go through the mapping table, which is a layer of indirection. In
  // SQL you could think of doing a LEFT JOIN onto this table and
  // using the id from the mapping table instead of the raw id
  let mapping = _data.todoTypeMapping.find((m) => m.id === id);
  let type =
    mapping && _data.todoTypes.find((type) => type.id === mapping?.targetId);
  return type && type.tombstone !== 1 ? type : null;
}

export function getNumTodos() {
  return _data.todos.length;
}

export function getTodoTypes(): TodoType[] {
  return _data.todoTypes.filter((todoType) => todoType.tombstone !== 1);
}

export function insertTodoType({ name, color }: Omit<TodoType, "id">) {
  let id = insert("todoTypes", { name, color });

  // Create an entry in the mapping table that points it to itself
  insert("todoTypeMapping", { id, targetId: id });
}

export function deleteTodoType(id: string, targetId: string | null) {
  if (targetId) {
    // We need to update all the pointers the point to the type that
    // we are deleting and point it to the new type. This already
    // includes the type we are deleting (when created, it creates a
    // mapping to itself)
    for (let mapping of _data.todoTypeMapping) {
      if (mapping.targetId === id) {
        update("todoTypeMapping", { id: mapping.id, targetId });
      }
    }
  }

  delete_("todoTypes", id);
}
