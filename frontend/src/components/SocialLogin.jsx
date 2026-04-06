import React from 'react'

const SocialLogin = () => {
  return (
    <div className="mt-8 w-full">
      <div className="flex items-center text-center mb-6 text-[var(--text-muted)] text-sm before:content-[''] before:flex-1 before:border-b before:border-[var(--border)] before:mr-2 after:content-[''] after:flex-1 after:border-b after:border-[var(--border)] after:ml-2">
        <span>Or sign in with</span>
      </div>
      <div className="flex justify-center gap-5">
        <button className="w-14 h-14 rounded-full bg-white border border-[var(--border)] flex justify-center items-center transition-all active:scale-90 active:bg-gray-50">
          <img className="w-6 h-6" src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg" alt="Apple" />
        </button>
        <button className="w-14 h-14 rounded-full bg-white border border-[var(--border)] flex justify-center items-center transition-all active:scale-90 active:bg-gray-50">
          <img className="w-6 h-6" src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" />
        </button>
        <button className="w-14 h-14 rounded-full bg-white border border-[var(--border)] flex justify-center items-center transition-all active:scale-90 active:bg-gray-50">
          <img className="w-6 h-6" src="https://upload.wikimedia.org/wikipedia/en/0/04/Facebook_f_logo_%282021%29.svg" alt="Facebook" />
        </button>
      </div>
    </div>
  )
}

export default SocialLogin
