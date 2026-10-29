"use client";
import { useState } from "react";
import { api, Lookups, money, Sale } from "../lib";
import { Empty, Icon } from "./ui";

export function Reports({
  connected,
  lookups,
}: {
  connected: boolean;
  lookups: Lookups;
}) {
  const [from, setFrom] = useState("2026-10-01"),
    [to, setTo] = useState("2026-10-31"),
    [branch, setBranch] = useState("");
  const [minQuantity, setMinQuantity] = useState("1"),
    [minRevenue, setMinRevenue] = useState("0");
  const [sales, setSales] = useState<Sale[]>([]),
    [hasReport, setHasReport] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [customer, setCustomer] = useState("KH01"),
    [streak, setStreak] = useState(""),
    [discount, setDiscount] = useState("");
  const [month, setMonth] = useState("10"),
    [year, setYear] = useState("2026"),
    [functionBranch, setFunctionBranch] = useState("CN01");
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {error && (
        <div className="inline-warning" role="alert">
          {error}
        </div>
      )}
      <section className="panel">
        <div className="section-title">
          <div>
            <h2>Doanh số theo sản phẩm</h2>
            <p>
              Giá trị món trước giảm giá hóa đơn, chỉ tính đơn hoàn tất. Bao gồm
              toàn bộ ngày kết thúc.
            </p>
          </div>
        </div>
        <form
          className="report-filter"
          onSubmit={(e) => {
            e.preventDefault();
            setSales([]);
            setHasReport(false);
            void run(async () => {
              setSales(
                await api<Sale[]>(
                  `reports/revenue?${new URLSearchParams({ from, to, branch, minQuantity, minRevenue })}`,
                ),
              );
              setHasReport(true);
            });
          }}
        >
          <label>
            Từ ngày
            <input
              required
              type="date"
              min="2020-01-01"
              max="2100-12-31"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            Đến ngày
            <input
              required
              type="date"
              min={from}
              max="2100-12-31"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <label>
            Chi nhánh
            <select value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="">Tất cả chi nhánh</option>
              {lookups.branches.map((c) => (
                <option key={c.Ma_CN} value={c.Ma_CN}>
                  {c.Ten_CN}
                </option>
              ))}
            </select>
          </label>
          <label>
            Số lượng tối thiểu
            <input
              type="number"
              required
              min="1"
              step="1"
              value={minQuantity}
              onChange={(e) => setMinQuantity(e.target.value)}
            />
          </label>
          <label>
            Doanh số tối thiểu
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={minRevenue}
              onChange={(e) => setMinRevenue(e.target.value)}
            />
          </label>
          <button className="button primary" disabled={busy || !connected}>
            Xem báo cáo
            <Icon name="arrow" size={16} />
          </button>
        </form>
        {hasReport && (
          <div className="report-summary">
            <div>
              <span>DOANH SỐ CÁC MÓN ĐÃ LỌC</span>
              <strong>
                {money(sales.reduce((s, x) => s + x.Tong_doanh_thu_mon, 0))}
              </strong>
            </div>
            <div>
              <span>SỐ LƯỢNG ĐÃ BÁN</span>
              <strong>
                {sales.reduce((s, x) => s + x.Tong_so_luong_ban, 0)}{" "}
                <small>món</small>
              </strong>
            </div>
          </div>
        )}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SẢN PHẨM</th>
                <th>SỐ ĐƠN XUẤT HIỆN</th>
                <th>SỐ LƯỢNG BÁN</th>
                <th>DOANH SỐ MÓN</th>
                <th>TRUNG BÌNH / DÒNG</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.Ma_SP}>
                  <td>
                    <strong>{s.Ten_SP}</strong>
                    <span className="cell-note">{s.Ma_SP}</span>
                  </td>
                  <td>{s.So_don_hang_xuat_hien}</td>
                  <td>{s.Tong_so_luong_ban}</td>
                  <td>
                    <strong className="price">
                      {money(s.Tong_doanh_thu_mon)}
                    </strong>
                  </td>
                  <td>{money(s.Doanh_thu_trung_binh_moi_luot)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!sales.length && (
          <Empty>
            {hasReport
              ? "Không có dữ liệu phù hợp với điều kiện báo cáo."
              : "Chọn điều kiện và nhấn Xem báo cáo."}
          </Empty>
        )}
      </section>
      <div className="two-column">
        <section className="panel function-panel">
          <span className="eyebrow">CHĂM SÓC KHÁCH HÀNG</span>
          <h2>Chuỗi lửa tích điểm</h2>
          <p>
            Tính chuỗi ngày chi tiêu từ 50.000 đồng và điểm thưởng đề xuất. Kết
            quả tra cứu không tự cộng vào ví điểm.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setStreak("");
              void run(async () => {
                setStreak(
                  (
                    await api<{ result: string }>(
                      `reports/streak?${new URLSearchParams({ customer, from, to })}`,
                    )
                  ).result,
                );
              });
            }}
          >
            <label>
              Khách hàng
              <select
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
              >
                {lookups.customers.map((k) => (
                  <option key={k.Ma_KH} value={k.Ma_KH}>
                    {k.Ho} {k.Ten}
                  </option>
                ))}
              </select>
            </label>
            <p className="subtle">Dùng khoảng ngày đã chọn ở trên.</p>
            <button className="button secondary" disabled={busy || !connected}>
              Phân tích chuỗi lửa
              <Icon name="arrow" size={16} />
            </button>
          </form>
          {streak && (
            <div className="function-result" role="status">
              {streak}
            </div>
          )}
        </section>
        <section className="panel function-panel">
          <span className="eyebrow">HIỆU QUẢ KHUYẾN MÃI</span>
          <h2>Giá trị ưu đãi chi nhánh</h2>
          <p>
            Xem thực thu và ngân sách trợ giá voucher theo tháng, từ các hóa đơn
            đã hoàn tất.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setDiscount("");
              void run(async () => {
                setDiscount(
                  (
                    await api<{ result: string }>(
                      `reports/discount?${new URLSearchParams({ branch: functionBranch, month, year })}`,
                    )
                  ).result,
                );
              });
            }}
          >
            <label>
              Chi nhánh
              <select
                value={functionBranch}
                onChange={(e) => setFunctionBranch(e.target.value)}
              >
                {lookups.branches.map((c) => (
                  <option key={c.Ma_CN} value={c.Ma_CN}>
                    {c.Ten_CN}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                Tháng
                <input
                  required
                  type="number"
                  min="1"
                  max="12"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </label>
              <label>
                Năm
                <input
                  required
                  type="number"
                  min="2020"
                  max="2100"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                />
              </label>
            </div>
            <button className="button secondary" disabled={busy || !connected}>
              Phân tích ưu đãi
              <Icon name="arrow" size={16} />
            </button>
          </form>
          {discount && (
            <div className="function-result" role="status">
              {discount}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
