import '@adonisjs/inertia/types'

import type { VNodeProps, AllowedComponentProps, ComponentInstance } from 'vue'

type ExtractProps<T> = Omit<
  ComponentInstance<T>['$props'],
  keyof VNodeProps | keyof AllowedComponentProps
>

declare module '@adonisjs/inertia/types' {
  export interface InertiaPages {
    'admin/categories/create': ExtractProps<(typeof import('../../inertia/pages/admin/categories/create.vue'))['default']>
    'admin/categories/edit': ExtractProps<(typeof import('../../inertia/pages/admin/categories/edit.vue'))['default']>
    'admin/categories/index': ExtractProps<(typeof import('../../inertia/pages/admin/categories/index.vue'))['default']>
    'auth/login': ExtractProps<(typeof import('../../inertia/pages/auth/login.vue'))['default']>
    'auth/signup': ExtractProps<(typeof import('../../inertia/pages/auth/signup.vue'))['default']>
    'errors/not_found': ExtractProps<(typeof import('../../inertia/pages/errors/not_found.vue'))['default']>
    'errors/server_error': ExtractProps<(typeof import('../../inertia/pages/errors/server_error.vue'))['default']>
    'home': ExtractProps<(typeof import('../../inertia/pages/home.vue'))['default']>
    'onboarding/index': ExtractProps<(typeof import('../../inertia/pages/onboarding/index.vue'))['default']>
    'organization/members': ExtractProps<(typeof import('../../inertia/pages/organization/members.vue'))['default']>
    'organization/settings': ExtractProps<(typeof import('../../inertia/pages/organization/settings.vue'))['default']>
    'products/index': ExtractProps<(typeof import('../../inertia/pages/products/index.vue'))['default']>
    'products/show': ExtractProps<(typeof import('../../inertia/pages/products/show.vue'))['default']>
    'supplier/products/create': ExtractProps<(typeof import('../../inertia/pages/supplier/products/create.vue'))['default']>
    'supplier/products/edit': ExtractProps<(typeof import('../../inertia/pages/supplier/products/edit.vue'))['default']>
    'supplier/products/index': ExtractProps<(typeof import('../../inertia/pages/supplier/products/index.vue'))['default']>
    'supplier/profile': ExtractProps<(typeof import('../../inertia/pages/supplier/profile.vue'))['default']>
    'suppliers/index': ExtractProps<(typeof import('../../inertia/pages/suppliers/index.vue'))['default']>
    'suppliers/show': ExtractProps<(typeof import('../../inertia/pages/suppliers/show.vue'))['default']>
  }
}
