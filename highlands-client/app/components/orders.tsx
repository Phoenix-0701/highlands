"use client";
import { useEffect, useState } from "react";
import { api, date, money, Order } from "../lib";
import { Badge, Empty, Modal } from "./ui";

export function Orders({
  connected,
  refresh,
  onChanged,
}: {
  connected: boolean;
  refresh: number;
  onChanged: (m: string) => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{
    order: Order;
    status: string;
  } | null>(null);
  useEffect(() => {
    let active = true;
    if (connected)
      api<Order[]>("orders")
        .then((x) => {
          if (active) setOrders(x);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [connected, refresh]);
  async function update() {
    if (!pending) return;
    setBusy(true);
    setError("");
    try {
      const r = await api<{ message: string }>(
        `orders/${pending.order.Ma_HD}/status`,
        { method: "PATCH", body: JSON.stringify({ status: pending.status }) },
      );
      setPending(null);
      onChanged(r.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <h2>Đơn hàng gần đây</h2>
          <p>
            Hoàn tất để cộng điểm; hủy để giải phóng voucher. Đơn đã kết thúc
            được giữ nguyên.
          </p>
        </div>
        <span className="count-pill">{orders.length} hóa đơn</span>
      </div>
      {error && !pending && (
        <div className="inline-warning" role="alert">
          {error}
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>HÓA ĐƠN</th>
              <th>KHÁCH HÀNG / CHI NHÁNH</th>
              <th>TỔNG / GIẢM</th>
              <th>THỰC THU</th>
              <th>ĐIỂM</th>
              <th>TRẠNG THÁI</th>
              <th>THAO TÁC</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.Ma_HD}>
                <td>
                  <strong>{o.Ma_HD}</strong>
                  <span className="cell-note">{date(o.Ngay_tao)}</span>
                </td>
                <td>
                  <strong>{o.Ten_KH}</strong>
                  <span className="cell-note">{o.Ten_CN}</span>
                </td>
                <td>
                  {money(o.Tong_tien)}
                  <span className="cell-note">
                    Giảm {money(o.So_tien_giam)}
                  </span>
                </td>
                <td>
                  <strong className="price">{money(o.Thanh_tien)}</strong>
                </td>
                <td>+{o.Diem_tich_luy_nhan}</td>
                <td>
                  <Badge value={o.Trang_thai} />
                </td>
                <td>
                  {["HOAN_TAT", "DA_HUY"].includes(o.Trang_thai) ? (
                    <span className="subtle">Đã khóa</span>
                  ) : (
                    <div className="order-actions">
                      {o.Trang_thai === "CHO_POS_XAC_NHAN" && (
                        <button
                          className="text-button"
                          onClick={() => {
                            setError("");
                            setPending({ order: o, status: "DANG_CHUAN_BI" });
                          }}
                        >
                          Xác nhận
                        </button>
                      )}
                      <button
                        className="text-button"
                        onClick={() => {
                          setError("");
                          setPending({ order: o, status: "HOAN_TAT" });
                        }}
                      >
                        Hoàn tất
                      </button>
                      <button
                        className="text-button danger-text"
                        onClick={() => {
                          setError("");
                          setPending({ order: o, status: "DA_HUY" });
                        }}
                      >
                        Hủy đơn
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!orders.length && <Empty>Chưa có hóa đơn để hiển thị.</Empty>}
      {pending && (
        <Modal
          title={
            pending.status === "HOAN_TAT"
              ? "Hoàn tất hóa đơn"
              : pending.status === "DA_HUY"
                ? "Hủy hóa đơn"
                : "Xác nhận chuẩn bị"
          }
          onClose={() => {
            if (!busy) setPending(null);
          }}
        >
          <div className="modal-content">
            <p>
              Áp dụng thao tác cho hóa đơn{" "}
              <strong>{pending.order.Ma_HD}</strong>?
            </p>
            <p className="subtle">
              {pending.status === "HOAN_TAT"
                ? "Hệ thống sẽ tính điểm, sử dụng voucher và khóa hóa đơn sau khi hoàn tất."
                : pending.status === "DA_HUY"
                  ? "Đơn sẽ được khóa; voucher chưa dùng được giải phóng."
                  : "Đơn được chuyển sang trạng thái đang chuẩn bị."}
            </p>
            {error && (
              <div className="inline-warning" role="alert">
                {error}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              Quay lại
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void update()}
            >
              {busy ? "Đang xử lý..." : "Xác nhận"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
