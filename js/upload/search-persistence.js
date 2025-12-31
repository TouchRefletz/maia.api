export class SearchPersistence {
  // INTERNAL IN-MEMORY STORAGE (Lost on Page Reload)
  // User explicitly requested: "se eu recarregar a página eu QUERO perder o histórico"
  static _memoryStorage = {};
  static KEY_PREFIX = "maia_search_";

  static startSession(slug) {
    if (!slug) return;
    try {
      this._memoryStorage[this.KEY_PREFIX + "active_slug"] = slug;
      this._memoryStorage[this.KEY_PREFIX + "status"] = "running";
      this._memoryStorage[this.KEY_PREFIX + "start_time"] = Date.now();
    } catch (e) {
      console.warn("SearchPersistence: Error starting session", e);
    }
  }

  static saveTasks(tasks) {
    try {
      this._memoryStorage[this.KEY_PREFIX + "tasks"] = JSON.stringify(tasks);
    } catch (e) {}
  }

  static finishSession(isSuccess = true) {
    try {
      this._memoryStorage[this.KEY_PREFIX + "status"] = isSuccess
        ? "completed"
        : "failed";
    } catch (e) {
      console.warn("SearchPersistence: Error finishing session", e);
    }
  }

  static saveManifest(manifest) {
    try {
      this._memoryStorage[this.KEY_PREFIX + "manifest"] =
        JSON.stringify(manifest);
    } catch (e) {
      console.warn("SearchPersistence: Error saving manifest", e);
    }
  }

  static getManifest() {
    try {
      const data = this._memoryStorage[this.KEY_PREFIX + "manifest"];
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  static getSession() {
    try {
      return {
        slug: this._memoryStorage[this.KEY_PREFIX + "active_slug"],
        status: this._memoryStorage[this.KEY_PREFIX + "status"],
        tasks: JSON.parse(
          this._memoryStorage[this.KEY_PREFIX + "tasks"] || "[]"
        ),
      };
    } catch (e) {
      return null;
    }
  }

  static clear() {
    this._memoryStorage = {};
  }
}
