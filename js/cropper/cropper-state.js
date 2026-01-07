// js/cropper/cropper-state.js

export const CropperState = {
  groups: [], // { id, label, crops: [], status: 'draft'|'sent' }
  activeGroupId: null,
  nextId: 1,

  // Listeners para reatividade simples
  listeners: [],

  subscribe(callback) {
    this.listeners.push(callback);
    return () =>
      (this.listeners = this.listeners.filter((cb) => cb !== callback));
  },

  notify() {
    this.listeners.forEach((cb) => cb(this));
  },

  // Actions
  createGroup(options = {}) {
    const id = this.nextId++;
    // O Label será ajustado pelo renumberGroups, mas definimos um inicial
    const newGroup = {
      id,
      label: `Questão`, // Placeholder
      crops: [],
      tags: options.tags || [], // New: Tags support (manual, ia, revisada)
      externalId: options.externalId || null, // ID externo (ex: do JSON da IA) para merging
      tipo: options.tipo || "questao_completa", // Guarda se nasceu como parte ou completa
      // Visual Status: 'draft' (default/gray) | 'verified' (cyan) | 'sent' (final)
      status: options.status || "draft",
    };
    this.groups.push(newGroup);
    this.renumberGroups(); // Garante o número correto sequencial
    this.activeGroupId = id;
    this.notify();
    return newGroup;
  },

  // Remove groups from a specific page that match a status (e.g., clear drafts)
  removeGroupsByPageAndStatus(pageNum, status) {
    // Filter out groups that match conditions
    const initialLength = this.groups.length;
    this.groups = this.groups.filter((g) => {
      // Check if group belongs to page (based on its first crop anchor)
      if (g.crops.length === 0) return true; // Keep empty groups? Or remove? Let's keep for now unless explicit.

      const firstCrop = g.crops[0];
      if (
        firstCrop.anchorData.anchorPageNum === pageNum &&
        g.status === status
      ) {
        return false; // Remove
      }
      return true; // Keep
    });

    if (this.groups.length !== initialLength) {
      if (
        this.activeGroupId &&
        !this.groups.find((g) => g.id === this.activeGroupId)
      ) {
        this.activeGroupId = null;
      }
      this.renumberGroups();
      this.notify();
    }
  },

  renumberGroups() {
    this.groups.forEach((group, index) => {
      group.label = `Questão ${index + 1}`;
    });
  },

  setActiveGroup(id) {
    // Se passar null, fecha o modo de edição
    this.activeGroupId = id;
    this.notify();
  },

  addCropToActiveGroup(cropData) {
    if (!this.activeGroupId) return;
    const group = this.groups.find((g) => g.id === this.activeGroupId);
    if (group) {
      // Gera um ID único para o crop caso precisemos referenciar individualmente
      cropData.id = Date.now() + Math.random();
      group.crops.push(cropData);
      this.notify();
    }
  },

  addCropToGroup(groupId, cropData) {
    const group = this.groups.find((g) => g.id === groupId);
    if (group) {
      cropData.id = Date.now() + Math.random();
      group.crops.push(cropData);
      this.notify();
    }
  },

  findGroupByExternalId(externalId) {
    if (!externalId) return null;
    return this.groups.find((g) => g.externalId === String(externalId));
  },

  removeLastCropFromActiveGroup() {
    if (!this.activeGroupId) return;
    const group = this.groups.find((g) => g.id === this.activeGroupId);
    if (group && group.crops.length > 0) {
      group.crops.pop();
      this.notify();
    }
  },

  updateCrop(cropId, newAnchorData) {
    if (!this.activeGroupId) return;
    const group = this.groups.find((g) => g.id === this.activeGroupId);
    if (group) {
      const cropIndex = group.crops.findIndex((c) => c.id === cropId);
      if (cropIndex !== -1) {
        group.crops[cropIndex].anchorData = newAnchorData;
        this.notify();
      }
    }
  },

  deleteGroup(id) {
    this.groups = this.groups.filter((g) => g.id !== id);
    if (this.activeGroupId === id) {
      this.activeGroupId = null;
    }
    this.renumberGroups(); // Reajusta os números após exclusão
    this.notify();
  },

  getActiveGroup() {
    return this.groups.find((g) => g.id === this.activeGroupId);
  },

  getAllCrops() {
    // Retorna flat list de todos os crops para renderização
    // active: booleano para style
    return this.groups.flatMap((g) =>
      g.crops.map((c) => ({
        ...c,
        groupId: g.id,
        status: g.status, // Propagate group status to crop
        isActiveGroup: g.id === this.activeGroupId,
      }))
    );
  },

  // Constraints
  pageConstraint: null, // { pageNum: number } or null

  setPageConstraint(pageNum) {
    this.pageConstraint = pageNum ? { pageNum } : null;
    // Não necessariamente notifica, pois isso afeta a lógica de interação (pointer logic), não o render dos crops existentes.
    // Mas se quisermos limpar crops fora da página, seria aqui. Por enquanto, só restrição de NOVA criação.
  },
};
