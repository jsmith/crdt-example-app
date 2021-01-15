import React, { useEffect } from "react";
import { onSync, sync } from "./sync";
import { backgroundSync, qs, sanitize } from "./main";
import { getTodoTypes, insertTodoType } from "./db";

export const App = () => {
  useEffect(() => {
    // render();

    let _syncMessageTimer: null | NodeJS.Timeout = null;

    onSync(() => {
      // TODO
      // render();

      let message = qs("#up-to-date") as HTMLElement;
      message.style.transition = "none";
      message.style.opacity = "1";

      if (_syncMessageTimer !== null) clearTimeout(_syncMessageTimer);
      _syncMessageTimer = setTimeout(() => {
        message.style.transition = "opacity .7s";
        message.style.opacity = "0";
      }, 1000);
    });

    sync().then(() => {
      if (getTodoTypes().length === 0) {
        // Insert some default types
        insertTodoType({ name: "Personal", color: "green" });
        insertTodoType({ name: "Work", color: "blue" });
      }
    });

    backgroundSync();
  }, []);

  // TODO
  const offline = false;
  const editingTodo = { tombstone: 1, name: "ALKALA" };

  return (
    <>
      <div className="flex flex-col h-full">
        <div
          id="scroller"
          className="flex flex-col flex-grow items-center pt-8 overflow-auto px-4 relative"
        >
          <div style={{ width: "100%", maxWidth: "600px" }}>
            <form id="add-form" className="flex">
              <input
                placeholder="Add todo..."
                className="shadow border border-gray-300 mr-2 flex-grow p-2 rounded"
              />
              {/* TODO */}
              {/* {renderTodoTypes()} */}
              <button
                id="btn-add-todo"
                className="bg-green-600 text-white rounded p-2"
              >
                Add
              </button>
            </form>

            <div className="mt-8" id="todos"></div>

            <h2 className="text-lg mt-24">Deleted todos</h2>
            <div className="mt-8" id="deleted-todos"></div>
          </div>

          <div
            id="up-to-date"
            className="fixed flex items-center mb-2 rounded bg-gray-800 px-4 py-3"
            style={{ opacity: 0, bottom: "80px" }}
          >
            <div className="flex flex-row items-center text-green-200 text-sm">
              <img
                src="check.svg"
                className="mr-1"
                style={{ width: "13px", height: "13px" }}
              />{" "}
              Up to date
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center relative border-t">
          <div className="relative">
            <button
              id="btn-sync"
              className={`m-4 mr-6 ${
                offline ? "bg-red-600" : "bg-blue-600"
              } text-white rounded p-2`}
            >
              Sync {offline ? "(offline)" : ""}
            </button>
          </div>

          <div className="absolute left-0 top-0 bottom-0 flex items-center pr-4 text-sm">
            <button
              id="btn-offline-simulate"
              className={`text-sm hover:bg-gray-300 px-2 py-1 rounded ${
                offline ? "text-blue-700" : "text-red-700"
              }`}
            >
              {offline ? "Go online" : "Simulate offline"}
            </button>
          </div>

          <div className="absolute right-0 top-0 bottom-0 flex items-center pr-4 text-sm">
            <button
              id="btn-add-type"
              className="text-sm hover:bg-gray-300 px-2 py-1 rounded"
            >
              Add type
            </button>
            <button
              id="btn-delete-type"
              className="text-sm hover:bg-gray-300 px-2 py-1 rounded"
            >
              Delete type
            </button>
          </div>
        </div>
      </div>

      {editingTodo && (
        <div
          className="absolute bottom-0 left-0 right-0 top-0 flex items-center justify-center"
          style={{ backgroundColor: "rgba(.2, .2, .2, .4)" }}
        >
          <div className="bg-white p-8" style={{ width: "500px" }}>
            <h2 className="text-lg font-bold mb-4">Edit todo</h2>
            <div className="flex">
              <input
                value={sanitize(editingTodo.name)}
                className="shadow border border-gray-300 mr-2 flex-grow p-2 rounded"
              />
              <button
                id="btn-edit-save"
                className="rounded p-2 bg-blue-600 text-white mr-2"
              >
                Save
              </button>
              <button id="btn-edit-cancel" className="rounded p-2 bg-gray-200">
                Cancel
              </button>
            </div>

            {editingTodo.tombstone === 1 && (
              <button id="btn-edit-undelete" className="pt-4 text-sm">
                Undelete
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default App;
