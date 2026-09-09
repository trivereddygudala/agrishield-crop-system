import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ServerCrash, RefreshCw, Home } from 'lucide-react';
import { Button } from '../components/ui/index';
import { useTranslation } from 'react-i18next';

const ServerErrorPage = () => {
  const { t } = useTranslation();

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center px-4 text-center overflow-hidden">
      <div className="absolute top-0 right-0 -z-10 h-96 w-96 rounded-full bg-rose-100/30 dark:bg-rose-950/20 blur-3xl" />
      <div className="absolute bottom-0 left-0 -z-10 h-96 w-96 rounded-full bg-amber-100/30 dark:bg-amber-950/20 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6 max-w-md"
      >
        <div className="mx-auto w-20 h-20 rounded-3xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center">
          <ServerCrash className="h-10 w-10 text-rose-600 dark:text-rose-400" />
        </div>

        <h1 className="font-extrabold text-slate-900 dark:text-slate-100 text-7xl tracking-tight leading-none" style={{ fontFamily: 'var(--font-display)' }}>
          500
        </h1>

        <h2 className="font-bold text-slate-900 dark:text-slate-100 text-2xl tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          {t('errors.server_error_title', 'Server Error')}
        </h2>

        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
          {t('errors.server_error_desc', 'Something went wrong on our end. Our team has been notified. Please try again in a few moments.')}
        </p>

        <div className="flex items-center justify-center gap-3 pt-4">
          <Button variant="primary" onClick={() => window.location.reload()} leftIcon={<RefreshCw className="w-4 h-4" />}>
            {t('errors.try_again', 'Try Again')}
          </Button>
          <Link to="/dashboard">
            <Button variant="outline" leftIcon={<Home className="w-4 h-4" />}>
              {t('errors.go_to_dashboard', 'Go to Dashboard')}
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default ServerErrorPage;
