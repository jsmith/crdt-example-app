import {
  deleteTodoType,
  delete_,
  getAllTodos,
  getDeletedTodos,
  getNumTodos,
  getTodos,
  getTodoTypes,
  insert,
  insertTodoType,
  Todo,
  TodoColor,
  update,
} from "./db";
import { setSyncingEnabled, sync } from "./sync";

type TODO = any;

export let qs = document.querySelector.bind(document);
export let qsa = document.querySelectorAll.bind(document);

function clear() {
  qs("#root")!.innerHTML = "";
}

function append(str: string, root = qs("#root")!) {
  let tpl = document.createElement("template");
  tpl.innerHTML = str;
  root.appendChild(tpl.content);
}

export function sanitize(string: string) {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
  };
  const reg = /[&<>"'/]/gi;
  return string.replace(reg, (match) => map[match]);
}

function getColor(name: TodoColor): string {
  switch (name) {
    case "green":
      return "bg-green-300";
    case "blue":
      return "bg-blue-300";
    case "red":
      return "bg-red-300";
    case "orange":
      return "bg-orange-300";
    case "yellow":
      return "bg-yellow-300";
    case "teal":
      return "bg-teal-300";
    case "purple":
      return "bg-purple-300";
    case "pink":
      return "bg-pink-300";
  }
}

let uiState: {
  offline: boolean;
  editingTodo: Todo | null | undefined;
  isAddingType: boolean;
  isDeletingType: boolean;
} = {
  offline: false,
  editingTodo: null,
  isAddingType: false,
  isDeletingType: false,
};

let _syncTimer: NodeJS.Timeout | null = null;
export function backgroundSync() {
  _syncTimer = setInterval(async () => {
    // Don't sync if an input is focused, otherwise if changes come in
    // we will clear the input (since everything is rerendered :))
    if (document.activeElement === document.body) {
      try {
        await sync();
        setOffline(false);
      } catch (e) {
        if (e.message === "network-failure") {
          setOffline(true);
        } else {
          throw e;
        }
      }
    }
  }, 4000);
}

function setOffline(flag: boolean) {
  if (flag !== uiState.offline) {
    uiState.offline = flag;
    setSyncingEnabled(!flag);
    render();
  }
}

let _scrollTop = 0;
function saveScroll() {
  let scroller = qs("#scroller");
  if (scroller) {
    _scrollTop = scroller.scrollTop;
  }
}

function restoreScroll() {
  let scroller = qs("#scroller");
  if (scroller) {
    scroller.scrollTop = _scrollTop;
  }
}

let _activeElement: string | null = null;
function saveActiveElement() {
  let el = document.activeElement!;
  _activeElement = el.id
    ? "#" + el.id
    : el.className
    ? "." + el.className.replace(/ ?hover\:[^ ]*/g, "").replace(/ /g, ".")
    : null;
}

function restoreActiveElement() {
  if (_activeElement) {
    let elements: NodeListOf<HTMLElement> = qsa(_activeElement);
    // Cheap focus management: only re-focus if there's a single
    // element, otherwise we don't know which one was focused
    if (elements.length === 1) {
      elements[0].focus();
    }
  }
}

function renderTodoTypes({
  className = "",
  showBlank,
}: { className?: string; showBlank?: boolean } = {}) {
  return `
    <select class="${className} mr-2 bg-transparent shadow border border-gray-300">
      ${showBlank ? '<option value=""></option>' : ""}
      ${getTodoTypes().map(
        (type) => `<option value="${type.id}">${type.name}</option>`
      )}
    </select>
  `;
}

function renderTodos({
  root,
  todos,
  isDeleted = false,
}: {
  root: HTMLElement;
  isDeleted?: boolean;
  todos: Todo[];
}) {
  todos.forEach((todo) => {
    append(
      // prettier-ignore
      `
        <div class="todo-item bg-gray-200 p-4 mb-4 rounded flex cursor-pointer" data-id="${todo.id}">
          <div class="flex-grow flex items-center">
            <div class="${isDeleted ? 'line-through' : ''}">${sanitize(todo.name)}</div>
            <div class="text-sm rounded ${todo.type ? getColor(todo.type.color) : ''} px-2 ml-3">
              ${todo.type ? sanitize(todo.type.name) : ''}
            </div>
          </div>
          <button class="btn-delete hover:bg-gray-400 px-2 rounded ${isDeleted ? 'hidden' : ''}" data-id="${todo.id}">X</button>
       </div>
      `,
      root
    );
  });
}

export function render() {
  document.documentElement.style.height = "100%";
  document.body.style.height = "100%";

  saveScroll();
  saveActiveElement();

  let root: HTMLElement | null = qs("#root");
  root!.style.height = "100%";

  let { offline, editingTodo, isAddingType, isDeletingType } = uiState;

  clear();

  // prettier-ignore

  renderTodos({ root: qs("#todos") as HTMLElement, todos: getTodos() });
  renderTodos({
    root: qs("#deleted-todos") as HTMLElement,
    todos: getDeletedTodos(),
    isDeleted: true,
  });

  if (editingTodo) {
    append(`
      <div class="absolute bottom-0 left-0 right-0 top-0 flex items-center justify-center" style="background-color: rgba(.2, .2, .2, .4)">
        <div class="bg-white p-8" style="width: 500px">
          <h2 class="text-lg font-bold mb-4">Edit todo</h2>
          <div class="flex">
            <input value="${sanitize(
              editingTodo.name
            )}" class="shadow border border-gray-300 mr-2 flex-grow p-2 rounded" />
            <button id="btn-edit-save" class="rounded p-2 bg-blue-600 text-white mr-2">Save</button>
            <button id="btn-edit-cancel" class="rounded p-2 bg-gray-200">Cancel</button>
          </div>

          ${
            editingTodo.tombstone === 1
              ? '<button id="btn-edit-undelete" class="pt-4 text-sm">Undelete</button>'
              : ""
          }
        </div>
      <div>
    `);
  }

  if (isAddingType) {
    append(`
      <div class="absolute bottom-0 left-0 right-0 top-0 flex items-center justify-center" style="background-color: rgba(.2, .2, .2, .4)">
        <div class="bg-white p-8" style="width: 500px">
          <h2 class="text-lg font-bold mb-4">Add todo type</h2>
          <div class="flex">
            <input placeholder="Name..." autofocus class="shadow border border-gray-300 mr-2 flex-grow p-2 rounded" />
            <button id="btn-edit-save" class="rounded p-2 bg-blue-600 text-white mr-2">Save</button>
            <button id="btn-edit-cancel" class="rounded p-2 bg-gray-200">Cancel</button>
          </div>
        </div>
      </div>
    `);
  }

  if (isDeletingType) {
    append(`
      <div class="absolute bottom-0 left-0 right-0 top-0 flex items-center justify-center" style="background-color: rgba(.2, .2, .2, .4)">
        <div class="bg-white p-8" style="width: 500px">
          <h2 class="text-lg font-bold mb-4">Delete todo type</h2>
          <div class="pb-2">
            Delete ${renderTodoTypes({ className: "selected" })} and
            merge into ${renderTodoTypes({
              className: "merge",
              showBlank: true,
            })}
          </div>

          <div class="flex mt-2">
            <button id="btn-edit-delete" class="rounded p-2 bg-red-600 text-white mr-2">Delete</button>
            <button id="btn-edit-cancel" class="rounded p-2 bg-gray-200">Cancel</button>
          </div>
        </div>
      </div>
    `);
  }

  addEventHandlers();
  restoreScroll();
  restoreActiveElement();
}

function addEventHandlers() {
  qs("#add-form")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    let [nameNode, typeNode] = (e.target as TODO).elements;
    let name = nameNode.value;
    let type = typeNode.selectedOptions[0].value;

    nameNode.value = "";
    typeNode.selectedIndex = 0;

    if (name === "") {
      alert("Todo can't be blank. C'mon!");
      return;
    }

    insert("todos", { name, type, order: getNumTodos() });
  });

  qs("#btn-sync")!.addEventListener("click", async (e) => {
    sync();
  });

  qs("#btn-offline-simulate")!.addEventListener("click", () => {
    if (uiState.offline) {
      setOffline(false);
      backgroundSync();
    } else {
      setOffline(true);
      if (_syncTimer !== null) clearInterval(_syncTimer);
    }
  });

  qs("#btn-add-type")!.addEventListener("click", () => {
    uiState.isAddingType = true;
    render();
  });

  qs("#btn-delete-type")!.addEventListener("click", () => {
    uiState.isDeletingType = true;
    render();
  });

  for (let todoNode of qsa(".todo-item")) {
    todoNode.addEventListener("click", (e) => {
      let todo = getTodos().find((t) => t.id === (todoNode as any).dataset.id);
      if (!todo) {
        // Search the deleted todos (this could be large, so only
        // searching the existing todos first which is the common case
        // is faster
        todo = getAllTodos().find((t) => t.id === (todoNode as any).dataset.id);
      }

      uiState.editingTodo = todo;
      render();
    });
  }

  for (let btn of qsa(".btn-delete")) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      delete_("todos", (e.target as TODO).dataset.id);
    });
  }

  if (uiState.editingTodo) {
    const local = uiState.editingTodo;
    qs("#btn-edit-save")!.addEventListener("click", (e) => {
      let input = (e.target as TODO).parentNode.querySelector("input");
      let value = input.value;

      update("todos", { id: local.id, name: value });
      uiState.editingTodo = null;
      render();
    });

    if (qs("#btn-edit-undelete")) {
      qs("#btn-edit-undelete")!.addEventListener("click", (e) => {
        let input = (e.target as TODO).parentNode.querySelector("input");
        let value = input.value;

        update("todos", { id: local.id, tombstone: 0 });
        uiState.editingTodo = null;
        render();
      });
    }
  } else if (uiState.isAddingType) {
    qs("#btn-edit-save")!.addEventListener("click", (e) => {
      let input = (e.target as TODO).parentNode.querySelector("input");
      let value = input.value;

      let colors: TodoColor[] = [
        "green",
        "blue",
        "red",
        "orange",
        "yellow",
        "teal",
        "purple",
        "pink",
      ];

      insertTodoType({
        name: value,
        color: colors[(Math.random() * colors.length) | 0],
      });
      uiState.isAddingType = false;
      render();
    });
  } else if (uiState.isDeletingType) {
    qs("#btn-edit-delete")!.addEventListener("click", (e) => {
      let modal = (e.target as TODO).parentNode;
      let selected = (qs("select.selected") as HTMLSelectElement)
        .selectedOptions[0].value;
      let merge = (qs("select.merge") as HTMLSelectElement).selectedOptions[0]
        .value;

      if (selected === merge) {
        alert("Cannot merge type into itself");
        return;
      }

      deleteTodoType(selected, merge !== "" ? merge : null);

      uiState.isDeletingType = false;
      render();
    });
  }

  let cancel = qs("#btn-edit-cancel");
  if (cancel) {
    cancel.addEventListener("click", () => {
      uiState.editingTodo = null;
      uiState.isAddingType = false;
      uiState.isDeletingType = false;
      render();
    });
  }
}
