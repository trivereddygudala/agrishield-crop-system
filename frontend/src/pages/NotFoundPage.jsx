import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Leaf, ArrowLeft, Home, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/index';
import { useTranslation } from 'react-i18next';

const NotFoundPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center px-4 text-center overflow-hidden">
      {/* Decorative Gradients */}
      <div className="absolute top-0 right-0 -z-10 h-96 w-96 rounded-full bg-emerald-100/30 dark:bg-emerald-950/20 blur-3xl" />
      <div className="absolute bottom-0 left-0 -z-10 h-96 w-96 rounded-full bg-teal-100/30 dark:bg-teal-950/20 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6 max-w-md"
      >
        <div className="mx-auto w-20 h-20 rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center">
          <Leaf className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
        </div>
        
        <h1 className="font-extrabold text-slate-900 dark:text-slate-100 text-7xl tracking-tight leading-none" style={{ fontFamily: 'var(--font-display)' }}>
          404
        </h1>
        
        <h2 className="font-bold text-slate-900 dark:text-slate-100 text-2xl tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          {t('errors.page_not_found_title', 'Page Not Found')}
        </h2>
        
        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
          {t('errors.page_not_found_desc', "The agricultural section you are trying to reach doesn't exist or has been relocated to another crop zone.")}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <Link to="/">
            <Button variant="primary" leftIcon={<Home className="w-4 h-4" />}>
              {t('errors.go_home', 'Go Home')}
            </Button>
          </Link>
          <Link to="/admin">
            <button className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer">
              {t('errors.admin_panel', '👑 Admin Panel')}
            </button>
          </Link>
          <Button variant="outline" onClick={() => window.history.back()} leftIcon={<ArrowLeft className="w-4 h-4" />}>
            {t('errors.go_back', 'Go Back')}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFoundPage;
