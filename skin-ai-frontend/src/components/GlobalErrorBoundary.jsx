import { Component } from "react";
import { Link } from "react-router-dom";

export default class GlobalErrorBoundary extends Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
    };
  }

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("GLOBAL ERROR BOUNDARY", {
      error,
      errorInfo,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-slate-100 px-4 py-10 flex items-center justify-center">
        <div className="w-full max-w-xl bg-white rounded-[28px] border border-slate-100 shadow-xl p-6 sm:p-8 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center text-3xl font-bold">
            !
          </div>

          <h1 className="mt-5 text-2xl sm:text-3xl font-bold text-slate-900">
            Terjadi Kesalahan
          </h1>

          <p className="mt-3 text-sm sm:text-base text-slate-500">
            Halaman mengalami kendala. Detail teknis sudah dikirim ke console
            browser untuk audit.
          </p>

          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={this.handleReload}
              className="btn-premium px-5 py-3 rounded-2xl bg-blue-600 text-white font-semibold"
            >
              Muat Ulang
            </button>

            <Link
              to="/dashboard"
              className="btn-premium px-5 py-3 rounded-2xl bg-slate-900 text-white font-semibold"
            >
              Kembali Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }
}


