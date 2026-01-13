import React, { useEffect, useState } from "react";

// Interfaces to type the CropperState interaction
interface CropperStateInterface {
  undo: () => void;
  redo: () => void;
  revert: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  editingSnapshot: any;
}

// Declare global CropperState if not available via import
declare const CropperState: CropperStateInterface;
declare const confirmImageSlotMode: () => void;
declare const cancelImageSlotMode: () => void;
declare const editImageSlotMode: (id: string) => void;
declare const deleteImageSlot: (id: string) => void;

declare global {
  interface Window {
    CropperState: any;
  }
}

interface SlotData {
  id: string;
  timestamp?: number;
  previewUrl?: string;
}

interface ImageSlotCardProps {
  slotId: string;
  label?: string;
  currentData?: SlotData | null;
}

export const ImageSlotCard: React.FC<ImageSlotCardProps> = ({
  slotId,
  label = "Imagem",
  currentData,
}) => {
  // State: 'empty' | 'capturing' | 'filled'
  // Initial state derived from props
  const [internalMode, setInternalMode] = useState<
    "empty" | "capturing" | "filled"
  >(currentData?.previewUrl ? "filled" : "empty");

  // Local state for UI re-renders (undo/redo definitions) usually handled by CropperState.subscribe
  // But here we might need to force update if we want buttons to enable/disable.
  const [_, setForceUpdate] = useState(0);

  // Sync internal mode with props if external data changes
  useEffect(() => {
    // Only auto-switch to filled if we have data AND we are not currently capturing.
    // This allows 'capturing' state (triggered by events) to persist even if currentData exists.
    if (currentData?.previewUrl) {
        setInternalMode(prev => prev === 'capturing' ? 'capturing' : 'filled');
    } else {
        // If no data, force empty (unless capturing? maybe safer to just go empty)
        setInternalMode(prev => prev === 'capturing' ? 'capturing' : 'empty');
    }
  }, [currentData]); // Removed internalMode from dep array to avoid loops, as we use functional setter

  useEffect(() => {
    const handleModeChange = (e: CustomEvent) => {
      // e.detail: { slotId, mode: 'capturing'|'filled'|'idle' }
      if (e.detail.slotId == slotId) {
        if (e.detail.mode === "idle") {
           // check if we have data to decide if empty or filled
           setInternalMode(currentData?.previewUrl ? "filled" : "empty");
        } else {
           setInternalMode(e.detail.mode);
        }
      }
    };
    
    // Listen to crop movements to update button states if needed? 
    // Or just simple interval/click triggers. 
    // For now simple buttons.

    window.addEventListener("image-slot-mode-change" as any, handleModeChange);
    return () => {
      window.removeEventListener("image-slot-mode-change" as any, handleModeChange);
    };
  }, [slotId, currentData]);


  // Helper to trigger start
  const handleStartCapture = () => {
    window.dispatchEvent(
      new CustomEvent("image-slot-action", {
        detail: { action: "start-capture", slotId },
      })
    );
  };

  const handleEdit = () => {
      // Call global function or dispatch
      if (typeof editImageSlotMode === 'function') {
          editImageSlotMode(slotId);
      } else {
          // Fallback dispatch
           window.dispatchEvent(
            new CustomEvent("image-slot-action", {
                detail: { action: "edit", slotId },
            })
           );
      }
  }

  const handleDelete = () => {
      if (typeof deleteImageSlot === 'function') {
          deleteImageSlot(slotId);
      } else {
           window.dispatchEvent(
             new CustomEvent("image-slot-action", {
                detail: { action: "delete", slotId },
             })
           );
      }
  }

  const handleConfirm = () => {
      if (typeof confirmImageSlotMode === 'function') {
          confirmImageSlotMode();
      }
  }
  
  const handleCancel = () => {
      if (typeof cancelImageSlotMode === 'function') {
          cancelImageSlotMode();
      }
  }

  // --- RENDERERS ---

  // Shared styles for the card container (Empty or Filled)
  const color = "#00BCD4"; // Cyan
  const borderColor = "5px solid rgb(0, 188, 212)";
  // Less opacity for empty state background maybe? Or consistent? Let's keep consistent for "Card" feel.
  const background = `linear-gradient(90deg, rgba(0, 188, 212, 0.082) 0%, transparent 40%)`;

  if (internalMode === "empty") {
    // Empty State - Dashed Placeholder INSIDE the standard card structure
    return (
      <div
        className="cropper-group-item image-slot-card empty"
        data-slot-id={slotId}
        style={{
            borderLeft: borderColor,
            background: background,
            transition: "background 0.4s",
            marginBottom: "10px",
            borderRadius: "4px",
            position: 'relative',
            width: '100%',
            boxSizing: 'border-box'
        }}
      >
        {/* Header - Identical to Sidebar */}
        <div className="cropper-group-header" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
            <span className="cropper-group-title" style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '14px', whiteSpace: 'nowrap' }}>
            {label}
            </span>
            <div className="cropper-group-tags" style={{ marginLeft: "auto", marginRight: "8px" }}>
                 <span className="question-badge" style={{
                     fontSize: '10px',
                     padding: '2px 6px',
                     borderRadius: '4px',
                     backgroundColor: 'rgba(255, 255, 255, 0.1)',
                     color: '#a0aec0',
                     border: '1px solid rgba(255, 255, 255, 0.1)',
                     whiteSpace: 'nowrap'
                 }}>VAZIO</span>
            </div>
        </div>

        {/* Content - Dashed Area */}
        <div style={{ padding: '0 12px 12px 12px', width: '100%', boxSizing: 'border-box' }}>
            <div 
                className="js-captura-trigger"
                data-action="select-slot"
                data-slot-id={slotId}
                data-idx={slotId} // Compatibility with both delegation checks
                style={{
                border: "2px dashed #4a5568",
                borderRadius: "6px",
                padding: "30px 20px",
                textAlign: "center",
                cursor: "pointer",
                color: "#a0aec0",
                transition: "all 0.2s ease",
                backgroundColor: "rgba(0, 0, 0, 0.2)",
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                boxSizing: 'border-box'
            }}
            title="Clique para adicionar uma imagem"
            >
                <div style={{ fontSize: "28px" }}>📷</div>
                <div style={{ fontSize: "13px", fontWeight: 500 }}>Clique para adicionar</div>
            </div>
        </div>
      </div>
    );
  }

  // Active / Filled Style (Shared Visuals)
  // Active / Filled Style (Shared Visuals)
  // Variables 'color', 'borderColor', 'background' are already defined above.

  return (
    <div
      className="cropper-group-item"
      style={{
        borderLeft: borderColor,
        background: background,
        transition: "background 0.4s",
        marginBottom: "10px",
        borderRadius: "4px", // Ensure slight rounded corners like sidebar
        position: 'relative',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      {/* Header */}
      <div className="cropper-group-header" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center' }}>
        <span className="cropper-group-title" style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '14px' }}>
          {label}
        </span>
        <div
          className="cropper-group-tags"
          style={{
            display: "flex",
            gap: "4px",
            marginLeft: "auto",
            marginRight: "8px",
          }}
        >
          {internalMode === 'capturing' && (
             <span className="question-badge manual" style={{
                 fontSize: '10px',
                 padding: '2px 6px',
                 borderRadius: '4px',
                 backgroundColor: 'rgba(255, 152, 0, 0.2)',
                 color: '#FF9800',
                 border: '1px solid rgba(255, 152, 0, 0.3)'
             }}>EDITANDO</span>
          )}
           {internalMode === 'filled' && (
             <span className="question-badge" style={{
                 fontSize: '10px',
                 padding: '2px 6px',
                 borderRadius: '4px',
                 backgroundColor: 'rgba(0, 188, 212, 0.2)',
                 color: '#00BCD4',
                 border: '1px solid rgba(0, 188, 212, 0.3)'
             }}>PREENCHIDO</span>
          )}
        </div>
      </div>

      {/* Content Area */}
      {internalMode === 'filled' && currentData?.previewUrl && (
          <div style={{ padding: '0 12px 12px 12px' }}>
              <img 
                src={currentData.previewUrl} 
                className="img-fluid" 
                style={{ 
                    borderRadius: '4px', 
                    border: '1px solid #4a5568', 
                    maxHeight: '200px', 
                    width: '100%', 
                    objectFit: 'contain',
                    backgroundColor: '#171923'
                }} 
              />
          </div>
      )}

      {/* Actions Footer */}
      <div className="cropper-actions" style={{ padding: '12px' }}>
        {internalMode === "capturing" ? (
          // --- CAPTURING MODE ACTIONS ---
          <div style={{ width: '100%' }}>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", width: '100%' }}>
              <button
                className="btn btn--secondary btn--sm"
                style={{ flex: 1, width: '100%', display: 'block' }}
                onClick={() => {
                    // Direct logic if accessible or via window
                    if (window.CropperState) window.CropperState.undo();
                }}
                title="Desfazer (Ctrl+Z)"
              >
                ⟲ Desfazer
              </button>
              <button
                className="btn btn--secondary btn--sm"
                style={{ flex: 1, width: '100%', display: 'block' }}
                onClick={() => {
                    if (window.CropperState) window.CropperState.redo();
                }}
                title="Refazer (Ctrl+Y)"
              >
                ⟳ Refazer
              </button>
            </div>

            <button
                className="btn btn--outline btn--sm btn--full-width"
                style={{ marginBottom: '0.5rem', width: '100%' }}
                onClick={handleCancel}
            >
                Cancelar
            </button>
            
            <button
                className="btn btn--primary btn--sm btn--full-width"
                style={{ width: '100%' }}
                onClick={handleConfirm}
            >
                Concluir
            </button>
          </div>
        ) : (
          // --- FILLED MODE ACTIONS ---
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
             <button
                className="btn btn--sm btn--secondary"
                style={{ flex: 1, display: 'block' }}
                onClick={handleEdit}
             >
                 Editar / Recortar
             </button>
             <button
                className="btn btn--sm btn--secondary"
                style={{ flex: 1, display: 'block', color: '#fc8181', borderColor: '#fc8181' }}
                onClick={handleDelete}
                title="Remover Imagem"
             >
                 Excluir
             </button>
          </div>
        )}
      </div>
    </div>
  );
};
