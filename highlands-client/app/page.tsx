"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, initialLookups, Lookups, money, Product } from "./lib";
import { Badge, Empty, Icon, Modal, Stat } from "./components/ui";
import { ProductForm } from "./components/product-form";
import { Reports } from "./components/reports";
import { Orders } from "./components/orders";
import { Loyalty } from "./components/loyalty";

type Tab = "menu" | "orders" | "loyalty" | "reports";
const titles: Record<Tab, [string, string]> = {
  menu: ["Thực đơn", "Chăm chút từng món, trọn vẹn từng trải nghiệm."],
  orders: ["Hóa đơn", "Theo dõi đơn hàng và trạng thái phục vụ tại cửa hàng."],
  loyalty: ["Điểm & voucher", "Mỗi lần ghé Highlands, thêm một niềm vui."],
  reports: [
    "Báo cáo kinh doanh",
    "Nhìn lại những con số, chuẩn bị cho những ngày tiếp theo.",
  ],
};
export default function Home() {
  const [tab, setTab] = useState<Tab>("menu");
  const [lookups, setLookups] = useState<Lookups>(initialLookups);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    type: "",
    status: "",
    sort: "TEN_ASC",
    minPrice: "",
    maxPrice: "",
  });
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      try {
        await api("health");
        setConnected(true);
      } catch (e) {
        setConnected(false);
        throw e;
      }
      const [info, items] = await Promise.all([
        api<Lookups>("lookups"),
        api<Product[]>(`products?${query}`),
      ]);
      setLookups(info);
      setProducts(items);
      setConnected(true);
    } catch (e) {
      setProducts([]);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [query]);
  useEffect(() => {
    void load();
  }, [load, refresh]);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 6000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  function change(field: keyof typeof filters, value: string) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }
  function filter(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (
      filters.minPrice &&
      filters.maxPrice &&
      Number(filters.minPrice) > Number(filters.maxPrice)
    ) {
      setError("Giá từ không được lớn hơn giá đến.");
      return;
    }
    setQuery(new URLSearchParams(filters).toString());
  }
  function changed(message: string) {
    setNotice(message);
    setRefresh((x) => x + 1);
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setDeleteError("");
    try {
      const r = await api<{ message: string }>(`products/${deleting.Ma_SP}`, {
        method: "DELETE",
      });
      setDeleting(null);
      changed(r.message);
    } catch (e) {
      setDeleteError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-seal">
            <span>HIGHLANDS</span>
            <Icon name="coffee" size={29} />
            <span>COFFEE</span>
          </div>
          <div className="brand-caption">GẮN KẾT NIỀM TỰ HÀO VIỆT</div>
        </div>
        <div className="workspace-label">KHÔNG GIAN QUẢN LÝ</div>
        <nav aria-label="Điều hướng chính">
          {(
            [
              ["menu", "Thực đơn"],
              ["orders", "Hóa đơn"],
              ["loyalty", "Điểm & voucher"],
              ["reports", "Báo cáo"],
            ] as const
          ).map(([id, text]) => (
            <button
              key={id}
              aria-label={text}
              aria-current={tab === id ? "page" : undefined}
              className={`nav-item ${tab === id ? "active" : ""}`}
              onClick={() => setTab(id)}
            >
              <Icon name={id} />
              <span>{text}</span>
              {tab === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="note-star">✦</span>
          <p>
            Từ những hạt cà phê Việt,
            <br />
            đến những trải nghiệm tốt hơn.
          </p>
          <span>HIGHLANDS OPERATIONS</span>
        </div>
        <div className="sidebar-footer">
          <div className="avatar">N1</div>
          <div>
            <strong>Nhóm 1</strong>
            <span>Hệ cơ sở dữ liệu · BTL2</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Quản lý vận hành <span>/</span>{" "}
            <strong>{tab === "reports" ? "Báo cáo" : titles[tab][0]}</strong>
          </div>
          <div className="topbar-right">
            <span className={`connection ${connected ? "online" : "offline"}`}>
              <i />
              {loading
                ? "Đang kiểm tra kết nối"
                : connected
                  ? "SQL Server đã kết nối"
                  : "Chưa kết nối SQL Server"}
            </span>
            <div className="top-avatar">N1</div>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">HIGHLANDS COFFEE / OPERATIONS</div>
              <h1>{titles[tab][0]}</h1>
              <p>{titles[tab][1]}</p>
            </div>
            <div className="heading-actions">
              <button
                className="button secondary"
                onClick={() => setRefresh((x) => x + 1)}
                disabled={loading}
              >
                <Icon name="refresh" />
                Làm mới
              </button>
              {tab === "menu" && (
                <button
                  className="button primary"
                  disabled={!connected}
                  onClick={() => setEditing("new")}
                >
                  <Icon name="plus" />
                  Thêm sản phẩm
                </button>
              )}
            </div>
          </div>
          {notice && (
            <div className="notice" role="status">
              <Icon name="check" />
              {notice}
              <button onClick={() => setNotice("")} aria-label="Ẩn thông báo">
                <Icon name="close" size={16} />
              </button>
            </div>
          )}
          {error && (
            <div className="error-banner" role="alert">
              <div>
                <strong>Chưa thực hiện được thao tác</strong>
                <p>{error}</p>
                {!connected && (
                  <p className="setup-command">
                    npm run setup → npm run db:up → npm run db:init → npm run
                    dev
                  </p>
                )}
              </div>
              <button onClick={() => setError("")} aria-label="Ẩn lỗi">
                <Icon name="close" size={18} />
              </button>
            </div>
          )}
          {tab === "menu" && (
            <>
              <div className="stats-grid">
                <Stat
                  title="Sản phẩm trong danh sách"
                  value={connected ? products.length : "—"}
                  icon="menu"
                  hint="Thực đơn được chọn"
                />
                <Stat
                  title="Đang phục vụ"
                  value={
                    connected
                      ? products.filter((p) => p.Trang_thai === "Đang bán")
                          .length
                      : "—"
                  }
                  icon="coffee"
                  hint="Sẵn sàng cho khách hàng"
                />
                <Stat
                  title="Danh mục thực đơn"
                  value={connected ? lookups.categories.length : "—"}
                  icon="loyalty"
                  hint="Cà phê, trà, bánh và hơn thế"
                />
              </div>
              <section className="panel menu-panel">
                <div className="section-title">
                  <div>
                    <h2>
                      Danh sách sản phẩm{" "}
                      <span className="count-pill">{products.length}</span>
                    </h2>
                    <p>Quản lý thông tin, giá bán và trạng thái từng món.</p>
                  </div>
                  <span className="subtle">Giá niêm yết · VNĐ</span>
                </div>
                <form className="filters" onSubmit={filter}>
                  <div className="filter-main">
                    <div className="search-field">
                      <Icon name="search" size={18} />
                      <input
                        aria-label="Tìm sản phẩm"
                        placeholder="Tìm tên hoặc mã sản phẩm..."
                        value={filters.search}
                        onChange={(e) => change("search", e.target.value)}
                      />
                    </div>
                    <select
                      aria-label="Danh mục"
                      value={filters.category}
                      onChange={(e) => change("category", e.target.value)}
                    >
                      <option value="">Tất cả danh mục</option>
                      {lookups.categories.map((c) => (
                        <option key={c.Ma_danh_muc} value={c.Ma_danh_muc}>
                          {c.Ten_danh_muc}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Loại sản phẩm"
                      value={filters.type}
                      onChange={(e) => change("type", e.target.value)}
                    >
                      <option value="">Tất cả loại món</option>
                      <option value="MON_NUOC">Món nước</option>
                      <option value="BANH_NGOT">Bánh ngọt</option>
                    </select>
                    <select
                      aria-label="Sắp xếp"
                      value={filters.sort}
                      onChange={(e) => change("sort", e.target.value)}
                    >
                      <option value="TEN_ASC">Tên: A → Z</option>
                      <option value="GIA_ASC">Giá: thấp → cao</option>
                      <option value="GIA_DESC">Giá: cao → thấp</option>
                    </select>
                  </div>
                  <div className="filter-extra">
                    <select
                      aria-label="Trạng thái bán"
                      value={filters.status}
                      onChange={(e) => change("status", e.target.value)}
                    >
                      <option value="">Tất cả trạng thái</option>
                      {["Đang bán", "Hết hàng", "Ngừng kinh doanh"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    <div className="price-filter">
                      <span>Khoảng giá</span>
                      <input
                        aria-label="Giá từ"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Từ"
                        value={filters.minPrice}
                        onChange={(e) => change("minPrice", e.target.value)}
                      />
                      <span>—</span>
                      <input
                        aria-label="Giá đến"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Đến"
                        value={filters.maxPrice}
                        onChange={(e) => change("maxPrice", e.target.value)}
                      />
                    </div>
                    <button className="button filter-button" disabled={loading}>
                      Áp dụng bộ lọc
                      <Icon name="arrow" size={16} />
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setFilters({
                          search: "",
                          category: "",
                          type: "",
                          status: "",
                          sort: "TEN_ASC",
                          minPrice: "",
                          maxPrice: "",
                        });
                        setQuery("");
                      }}
                    >
                      Đặt lại
                    </button>
                  </div>
                </form>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>SẢN PHẨM</th>
                        <th>DANH MỤC</th>
                        <th>GIÁ BÁN</th>
                        <th>KÍCH THƯỚC</th>
                        <th>TRẠNG THÁI</th>
                        <th className="right">THAO TÁC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p, i) => (
                        <tr key={p.Ma_SP}>
                          <td>
                            <div className="product-cell">
                              <div
                                className={`product-art tone-${p.Loai_SP === "BANH_NGOT" ? "cake" : i % 3 === 0 ? "tea" : i % 3 === 1 ? "coffee" : "freeze"}`}
                              >
                                <Icon
                                  name={
                                    p.Loai_SP === "BANH_NGOT"
                                      ? "cake"
                                      : "coffee"
                                  }
                                  size={28}
                                />
                              </div>
                              <div>
                                <strong>{p.Ten_SP}</strong>
                                <span>
                                  {p.Ma_SP} <b>·</b>{" "}
                                  {p.Loai_SP === "MON_NUOC"
                                    ? "Món nước"
                                    : "Bánh ngọt"}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="category-stack">
                              {p.Danh_muc.map((c) => (
                                <span key={c.Ma_danh_muc}>
                                  {c.Ten_danh_muc}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>
                            <strong className="price">{money(p.Gia_tu)}</strong>
                            {p.Gia_den > p.Gia_tu && (
                              <span className="cell-note">
                                đến {money(p.Gia_den)}
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="size-list">
                              {p.Bang_gia.length ? (
                                p.Bang_gia.map((s) => (
                                  <span
                                    key={s.Ma_size}
                                    title={money(s.Gia_ban)}
                                  >
                                    {s.Ma_size}
                                  </span>
                                ))
                              ) : (
                                <span className="standard-size">
                                  Tiêu chuẩn
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <Badge value={p.Trang_thai} />
                          </td>
                          <td>
                            <div className="row-actions">
                              <button
                                className="icon-button"
                                aria-label={`Sửa ${p.Ten_SP}`}
                                title={`Sửa ${p.Ten_SP}`}
                                onClick={() => setEditing(p)}
                              >
                                <Icon name="edit" size={17} />
                              </button>
                              <button
                                className="icon-button danger-icon"
                                aria-label={`Xóa ${p.Ten_SP}`}
                                title={`Xóa ${p.Ten_SP}`}
                                onClick={() => {
                                  setDeleteError("");
                                  setDeleting(p);
                                }}
                              >
                                <Icon name="trash" size={17} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!products.length && (
                  <Empty>
                    {loading
                      ? "Đang tải thực đơn..."
                      : connected
                        ? "Không tìm thấy sản phẩm phù hợp. Thử thay đổi bộ lọc."
                        : "Thực đơn sẽ xuất hiện khi kết nối cơ sở dữ liệu thành công."}
                  </Empty>
                )}
                <div className="table-footer">
                  <span>
                    {loading
                      ? "Đang tải..."
                      : `Hiển thị ${products.length} sản phẩm`}
                  </span>
                  <span>
                    <span className="legend-dot" />
                    Mỗi sản phẩm có thể thuộc nhiều danh mục
                  </span>
                </div>
              </section>
              <div className="bottom-note">
                <Icon name="database" size={15} />
                <span>
                  Dữ liệu đồng bộ trực tiếp với cơ sở dữ liệu Highlands Coffee
                </span>
                <span>NHÓM 1 · CO2013</span>
              </div>
            </>
          )}
          {tab === "orders" && (
            <Orders
              connected={connected}
              refresh={refresh}
              onChanged={changed}
            />
          )}
          {tab === "loyalty" && (
            <Loyalty
              connected={connected}
              refresh={refresh}
              lookups={lookups}
              onChanged={changed}
            />
          )}
          {tab === "reports" && (
            <Reports connected={connected} lookups={lookups} />
          )}
        </main>
        <footer className="page-footer">
          <span>Highlands Coffee · Hệ thống quản lý vận hành</span>
          <span>Bài tập lớn 2 · Hệ cơ sở dữ liệu</span>
        </footer>
      </div>
      {editing && (
        <ProductForm
          item={editing === "new" ? null : editing}
          lookups={lookups}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            changed(message);
          }}
        />
      )}
      {deleting && (
        <Modal
          title="Xóa sản phẩm"
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <div className="modal-content">
            <p>
              Bạn muốn xóa <strong>{deleting.Ten_SP}</strong> ({deleting.Ma_SP}
              )?
            </p>
            <p className="subtle">
              Chỉ xóa được sản phẩm chưa có hóa đơn. Với sản phẩm đã bán, hãy
              chuyển trạng thái sang “Ngừng kinh doanh”.
            </p>
            {deleting.So_hoa_don > 0 && (
              <div className="inline-warning">
                Sản phẩm hiện xuất hiện trong {deleting.So_hoa_don} hóa đơn. Cơ
                sở dữ liệu sẽ từ chối xóa để giữ lịch sử.
              </div>
            )}
            {deleteError && (
              <div className="inline-warning" role="alert">
                {deleteError}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Quay lại
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy ? "Đang xử lý..." : "Xóa sản phẩm"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
