function initializeNavigation() {

  bindSidebarNavigation();

  bindMobileNavigation();

}

function bindSidebarNavigation() {

  const buttons =
    document.querySelectorAll(
      '[data-view], [data-page]'
    );

  buttons.forEach(
    button => {

      button.addEventListener(
        'click',
        () => {

          const target =

            button.dataset.view ||

            button.dataset.page ||

            '';

          if (!target)
            return;

          switchPage(
            target
          );

        }
      );

    }
  );

}

function bindMobileNavigation() {

  const toggle =
    document.getElementById(
      'mobileSidebarToggle'
    );

  const sidebar =
    document.getElementById(
      'sidebar'
    );

  const overlay =
    document.getElementById(
      'mobileSidebarOverlay'
    );

  if (
    toggle &&
    sidebar
  ) {

    toggle.addEventListener(
      'click',
      () => {

        sidebar.classList.toggle(
          'mobile-open'
        );

        if (overlay) {

          overlay.classList.toggle(
            'active'
          );

        }

      }
    );

  }

  if (
    overlay &&
    sidebar
  ) {

    overlay.addEventListener(
      'click',
      () => {

        sidebar.classList.remove(
          'mobile-open'
        );

        overlay.classList.remove(
          'active'
        );

      }
    );

  }

}

document.addEventListener(
  'DOMContentLoaded',
  initializeNavigation
);

window.initializeNavigation =
  initializeNavigation;