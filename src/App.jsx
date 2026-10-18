import { useState, useEffect, useRef } from "react";
import { GripVertical, Plus, X, ImageOff, Sparkles, Upload, Check, Search } from "lucide-react";
import { idbGet, idbSet } from "./idb.js";

const ACCENT = "#FF4655";
const ACCENT_SOFT = "#FF465522";
const STORAGE_KEY = "anime-ranking-list";
const MAX_DIM = 500; // px, para no guardar imágenes gigantes

const seed = [
  { id: "seed-1", name: "Frieren: Beyond Journey's End", image: "" },
  { id: "seed-2", name: "Kaiju No. 8", image: "" },
  { id: "seed-3", name: "Vinland Saga", image: "" },
];

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// Redimensiona y comprime la imagen elegida a base64 (JPEG), para no llenar el almacenamiento.
function fileToCompressedDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("No se pudo leer la imagen"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else if (height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [items, setItems] = useState(seed);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [saveState, setSaveState] = useState("idle");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editImage, setEditImage] = useState("");
  const [viewingItem, setViewingItem] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef(null);
  const editFileInputRef = useRef(null);
  const listRef = useRef(null);
  const draggingRef = useRef(null); // guarda el id que se está arrastrando, sin re-render

  useEffect(() => {
    (async () => {
      try {
        const stored = await idbGet(STORAGE_KEY);
        if (Array.isArray(stored) && stored.length > 0) setItems(stored);
      } catch (e) {
        // sin datos guardados aún, se queda con el seed
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      try {
        await idbSet(STORAGE_KEY, items);
        setSaveState("saved");
      } catch (e) {
        setSaveState("error");
      }
    }, 250);
    return () => clearTimeout(t);
  }, [items, loaded]);

  // Cuando se busca algo, salta suavemente hasta el primer resultado para mostrar su puesto.
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;
    const match = items.find((i) => i.name.toLowerCase().includes(q));
    if (match) {
      const el = document.querySelector(`[data-item-id="${match.id}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [searchQuery]);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setImagePreview(dataUrl);
    } catch (err) {
      alert("No se pudo procesar esa imagen. Prueba con otra.");
    }
  }

  function addAnime() {
    if (!name.trim()) return;
    setItems((prev) => [...prev, { id: uid(), name: name.trim(), image: imagePreview }]);
    setName("");
    setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeAnime(id) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function startEdit(item) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditImage(item.image || "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditImage("");
  }

  function saveEdit() {
    if (!editName.trim()) return;
    setItems((prev) =>
      prev.map((i) => (i.id === editingId ? { ...i, name: editName.trim(), image: editImage } : i))
    );
    cancelEdit();
  }

  async function handleEditFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setEditImage(dataUrl);
    } catch (err) {
      alert("No se pudo procesar esa imagen. Prueba con otra.");
    }
  }

  // --- Arrastre táctil (solo desde el ícono ⠿, para no interferir con el scroll normal) ---
  const autoScrollFrame = useRef(null);
  const startPoint = useRef({ x: 0, y: 0 });
  const lastPointerY = useRef(0);

  function startDrag(e, id) {
    draggingRef.current = id;
    setDragId(id);
    startPoint.current = { x: e.clientX, y: e.clientY };
    lastPointerY.current = e.clientY;
    try {
      e.target.setPointerCapture?.(e.pointerId);
    } catch (_) {
      // algunos navegadores no lo permiten fuera del elemento original; no es crítico
    }
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  }

  // El grip (⠿) sigue permitiendo iniciar el arrastre al instante, sin espera.
  function handlePointerDownOnGrip(e, id) {
    e.preventDefault();
    startDrag(e, id);
  }

  function handlePointerMove(e) {
    if (!draggingRef.current) return;
    lastPointerY.current = e.clientY;
    reorderUnderPoint(e.clientX, e.clientY);
    maybeAutoScroll(e.clientY);
  }

  function reorderUnderPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    const li = el?.closest?.("[data-item-id]");
    if (!li) return;
    const targetId = li.getAttribute("data-item-id");
    if (targetId && targetId !== draggingRef.current) {
      setOverId(targetId);
      setItems((prev) => {
        const arr = [...prev];
        const fromIdx = arr.findIndex((i) => i.id === draggingRef.current);
        const toIdx = arr.findIndex((i) => i.id === targetId);
        if (fromIdx === -1 || toIdx === -1) return prev;
        const [moved] = arr.splice(fromIdx, 1);
        arr.splice(toIdx, 0, moved);
        return arr;
      });
    }
  }

  // Si arrastrás cerca del borde superior/inferior de la pantalla, la lista se desplaza sola,
  // para poder mover un anime a una posición fuera de la vista actual.
  function maybeAutoScroll(y) {
    const margin = 90;
    const vh = window.innerHeight;
    let speed = 0;
    if (y < margin) speed = -Math.ceil((margin - y) / 4) - 3;
    else if (y > vh - margin) speed = Math.ceil((y - (vh - margin)) / 4) + 3;

    cancelAnimationFrame(autoScrollFrame.current);
    if (speed !== 0) {
      const step = () => {
        window.scrollBy(0, speed);
        reorderUnderPoint(startPoint.current.x, lastPointerY.current);
        autoScrollFrame.current = requestAnimationFrame(step);
      };
      autoScrollFrame.current = requestAnimationFrame(step);
    }
  }

  function handlePointerUp() {
    draggingRef.current = null;
    setDragId(null);
    setOverId(null);
    cancelAnimationFrame(autoScrollFrame.current);
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerUp);
  }

  function moveByStep(id, dir) {
    setItems((prev) => {
      const arr = [...prev];
      const idx = arr.findIndex((i) => i.id === id);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= arr.length) return prev;
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0B0B0F",
        color: "#F2F1ED",
        fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
        padding: "32px 16px 80px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <header style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                <Sparkles size={22} color={ACCENT} strokeWidth={2.5} />
                <h1
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 900,
                    fontSize: 36,
                    letterSpacing: "-0.02em",
                    margin: 0,
                    textTransform: "uppercase",
                  }}
                >
                  Mi Ranking de Anime
                </h1>
              </div>
              <p style={{ fontFamily: "Barlow, sans-serif", color: "#8B8A94", fontSize: 15, margin: 0 }}>
                Mantén presionado ⠿ para reordenar. Toca el nombre o la imagen para editarlos.
              </p>
            </div>

            <button
              onClick={() => {
                setSearchOpen((o) => !o);
                if (searchOpen) setSearchQuery("");
              }}
              aria-label="Buscar anime"
              style={{
                flexShrink: 0,
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: `1px solid ${searchOpen ? ACCENT : "#232228"}`,
                background: searchOpen ? ACCENT_SOFT : "#151419",
                color: searchOpen ? ACCENT : "#8B8A94",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <Search size={18} />
            </button>
          </div>

          {searchOpen && (
            <div style={{ marginTop: 14, position: "relative" }}>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar anime en la lista..."
                autoFocus
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: "#151419",
                  border: `1px solid ${ACCENT}`,
                  borderRadius: 8,
                  padding: "10px 36px 10px 12px",
                  color: "#F2F1ED",
                  fontFamily: "Barlow, sans-serif",
                  fontSize: 15,
                  outline: "none",
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  aria-label="Limpiar búsqueda"
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#5C5B64",
                    cursor: "pointer",
                    display: "flex",
                    padding: 4,
                  }}
                >
                  <X size={16} />
                </button>
              )}
              {searchQuery.trim() &&
                (() => {
                  const q = searchQuery.trim().toLowerCase();
                  const count = items.filter((i) => i.name.toLowerCase().includes(q)).length;
                  return (
                    <div
                      style={{
                        marginTop: 6,
                        fontFamily: "Barlow, sans-serif",
                        fontSize: 12,
                        color: "#5C5B64",
                      }}
                    >
                      {count === 0
                        ? "Sin resultados"
                        : `${count} resultado${count > 1 ? "s" : ""} resaltado${count > 1 ? "s" : ""}`}
                    </div>
                  );
                })()}
            </div>
          )}
        </header>

        <div
          style={{
            background: "#151419",
            border: "1px solid #232228",
            borderRadius: 14,
            padding: 16,
            marginBottom: 28,
          }}
        >
          <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
            <label
              style={{
                width: 64,
                height: 64,
                flexShrink: 0,
                borderRadius: 8,
                border: `1.5px dashed ${imagePreview ? ACCENT : "#3A3940"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                cursor: "pointer",
                background: "#0B0B0F",
                position: "relative",
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: 0,
                  cursor: "pointer",
                }}
              />
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="preview"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <Upload size={20} color="#5C5B64" />
              )}
            </label>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addAnime()}
                placeholder="Nombre del anime"
                style={{
                  background: "#0B0B0F",
                  border: "1px solid #2A2930",
                  borderRadius: 8,
                  padding: "10px 12px",
                  color: "#F2F1ED",
                  fontFamily: "Barlow, sans-serif",
                  fontSize: 15,
                  outline: "none",
                }}
              />
              <span style={{ fontFamily: "Barlow, sans-serif", fontSize: 12, color: "#5C5B64" }}>
                Toca el cuadro para elegir una foto de tu galería (opcional)
              </span>
            </div>
          </div>

          <button
            onClick={addAnime}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              width: "100%",
              background: ACCENT,
              border: "none",
              borderRadius: 8,
              padding: "10px 14px",
              color: "#0B0B0F",
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700,
              fontSize: 16,
              textTransform: "uppercase",
              letterSpacing: "0.02em",
              cursor: "pointer",
            }}
          >
            <Plus size={18} strokeWidth={3} />
            Añadir a la lista
          </button>
        </div>

        {items.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px 16px",
              color: "#5C5B64",
              fontFamily: "Barlow, sans-serif",
              border: "1px dashed #232228",
              borderRadius: 14,
            }}
          >
            Tu lista está vacía. Añade tu primer anime arriba.
          </div>
        ) : (
          <ul
            ref={listRef}
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              WebkitUserSelect: "none",
              userSelect: "none",
              WebkitTouchCallout: "none",
            }}
          >
            {items.map((item, idx) => {
              const isDragging = dragId === item.id;
              const isOver = overId === item.id && dragId !== item.id;
              const isEditing = editingId === item.id;
              const query = searchQuery.trim().toLowerCase();
              const isSearching = query.length > 0;
              const isMatch = isSearching && item.name.toLowerCase().includes(query);

              if (isEditing) {
                return (
                  <li
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      background: "#1B1A20",
                      border: `1px solid ${ACCENT}`,
                      borderRadius: 12,
                      padding: 10,
                    }}
                  >
                    <label
                      style={{
                        width: 56,
                        height: 56,
                        flexShrink: 0,
                        borderRadius: 8,
                        border: "1.5px dashed #3A3940",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        cursor: "pointer",
                        background: "#0B0B0F",
                        position: "relative",
                      }}
                    >
                      <input
                        ref={editFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleEditFileChange}
                        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                      />
                      {editImage ? (
                        <img
                          src={editImage}
                          alt="preview"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <Upload size={18} color="#5C5B64" />
                      )}
                    </label>

                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                      autoFocus
                      style={{
                        flex: 1,
                        minWidth: 0,
                        background: "#0B0B0F",
                        border: "1px solid #2A2930",
                        borderRadius: 8,
                        padding: "8px 10px",
                        color: "#F2F1ED",
                        fontFamily: "Barlow, sans-serif",
                        fontSize: 15,
                        outline: "none",
                      }}
                    />

                    <button
                      onClick={saveEdit}
                      aria-label="Guardar"
                      style={{
                        background: ACCENT,
                        border: "none",
                        borderRadius: 8,
                        padding: 8,
                        display: "flex",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      <Check size={18} color="#0B0B0F" strokeWidth={3} />
                    </button>
                    <button
                      onClick={cancelEdit}
                      aria-label="Cancelar"
                      style={{
                        background: "none",
                        border: "none",
                        color: "#5C5B64",
                        cursor: "pointer",
                        flexShrink: 0,
                        padding: 4,
                        display: "flex",
                      }}
                    >
                      <X size={18} />
                    </button>
                  </li>
                );
              }

              return (
                <li
                  key={item.id}
                  data-item-id={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    background: isOver ? ACCENT_SOFT : isMatch ? ACCENT_SOFT : "#151419",
                    border: `1px solid ${isOver ? ACCENT : isMatch ? ACCENT : "#232228"}`,
                    borderRadius: 12,
                    padding: 10,
                    opacity: isDragging ? 0.5 : isSearching && !isMatch ? 0.3 : 1,
                    transition: isDragging ? "none" : "background 0.15s, border-color 0.15s, opacity 0.15s",
                    touchAction: isDragging ? "none" : "pan-y",
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontWeight: 900,
                      fontSize: 18,
                      color: idx < 3 ? ACCENT : "#5C5B64",
                    }}
                  >
                    {idx + 1}
                  </div>

                  <div
                    onClick={() => (item.image ? setViewingItem(item) : startEdit(item))}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 8,
                      overflow: "hidden",
                      flexShrink: 0,
                      background: "#0B0B0F",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px solid #232228",
                      cursor: "pointer",
                    }}
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    ) : (
                      <ImageOff size={20} color="#3A3940" />
                    )}
                  </div>

                  <div
                    onClick={() => startEdit(item)}
                    style={{
                      flex: 1,
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontWeight: 600,
                      fontSize: 18,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      cursor: "pointer",
                    }}
                  >
                    {item.name}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <button
                      onClick={() => moveByStep(item.id, -1)}
                      disabled={idx === 0}
                      aria-label="Subir"
                      style={arrowBtnStyle(idx === 0)}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveByStep(item.id, 1)}
                      disabled={idx === items.length - 1}
                      aria-label="Bajar"
                      style={arrowBtnStyle(idx === items.length - 1)}
                    >
                      ▼
                    </button>
                  </div>

                  <div
                    onPointerDown={(e) => handlePointerDownOnGrip(e, item.id)}
                    onContextMenu={(e) => e.preventDefault()}
                    style={{
                      flexShrink: 0,
                      padding: 8,
                      margin: -8,
                      touchAction: "none",
                      cursor: "grab",
                      display: "flex",
                      WebkitUserSelect: "none",
                      userSelect: "none",
                      WebkitTouchCallout: "none",
                    }}
                  >
                    <GripVertical size={18} color={isDragging ? ACCENT : "#3A3940"} />
                  </div>

                  <button
                    onClick={() => removeAnime(item.id)}
                    aria-label="Eliminar"
                    style={{
                      background: "none",
                      border: "none",
                      color: "#5C5B64",
                      cursor: "pointer",
                      flexShrink: 0,
                      padding: 4,
                      display: "flex",
                    }}
                  >
                    <X size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div
          style={{
            marginTop: 20,
            textAlign: "center",
            fontFamily: "Barlow, sans-serif",
            fontSize: 12,
            color: "#5C5B64",
          }}
        >
          {saveState === "saving" && "Guardando…"}
          {saveState === "saved" && "Lista guardada en este dispositivo"}
          {saveState === "error" && "No se pudo guardar"}
        </div>
      </div>

      {viewingItem && (
        <div
          onClick={() => setViewingItem(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(5,5,7,0.95)",
            zIndex: 50,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            boxSizing: "border-box",
          }}
        >
          <button
            onClick={() => setViewingItem(null)}
            aria-label="Cerrar"
            style={{
              position: "absolute",
              top: "max(16px, env(safe-area-inset-top, 0px))",
              right: 16,
              background: "rgba(255,255,255,0.08)",
              border: "none",
              borderRadius: "50%",
              width: 40,
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#F2F1ED",
              cursor: "pointer",
            }}
          >
            <X size={20} />
          </button>

          <img
            src={viewingItem.image}
            alt={viewingItem.name}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "100%",
              maxHeight: "72vh",
              objectFit: "contain",
              borderRadius: 10,
            }}
          />

          <div
            style={{
              marginTop: 16,
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700,
              fontSize: 20,
              color: "#F2F1ED",
              textAlign: "center",
            }}
          >
            {viewingItem.name}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              const item = viewingItem;
              setViewingItem(null);
              startEdit(item);
            }}
            style={{
              marginTop: 18,
              background: "none",
              border: `1px solid ${ACCENT}`,
              color: ACCENT,
              borderRadius: 8,
              padding: "8px 18px",
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700,
              fontSize: 14,
              textTransform: "uppercase",
              letterSpacing: "0.02em",
              cursor: "pointer",
            }}
          >
            Editar
          </button>
        </div>
      )}
    </div>
  );
}

function arrowBtnStyle(disabled) {
  return {
    background: "none",
    border: "none",
    color: disabled ? "#2A2930" : "#8B8A94",
    cursor: disabled ? "default" : "pointer",
    fontSize: 10,
    lineHeight: 1,
    padding: 2,
  };
}
