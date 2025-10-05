document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('search');
  const categorySelect = document.getElementById('category');
  const subcategorySelect = document.getElementById('subcategory');
  const subcategorySection = document.getElementById('subcategory-section');

  // Define subcategories for each category
  const subcategories = {
    tools: ['Hand Tools', 'Power Tools', 'Measuring Tools'],
    materials: ['Wood', 'Metal', 'Concrete', 'Insulation'],
    equipment: ['Heavy Machinery', 'Safety Equipment', 'Ladders'],
    roofing: ['Shingles', 'Tiles', 'Metal Roofing', 'Flat Roofing']
  };

  function populateSubcategories(category) {
    subcategorySelect.innerHTML = '<option value="">All Subcategories</option>';
    if (subcategories[category]) {
      subcategories[category].forEach(sub => {
        const option = document.createElement('option');
        option.value = sub.toLowerCase().replace(' ', '-');
        option.textContent = sub;
        subcategorySelect.appendChild(option);
      });
    }
  }

  function filterItems() {
    const searchTerm = searchInput.value.toLowerCase();
    const category = categorySelect.value;
    const subcategory = subcategorySelect.value;

    const itemDivs = document.querySelectorAll('#items-grid > div');
    itemDivs.forEach(div => {
      const name = div.dataset.name.toLowerCase();
      const description = div.dataset.description.toLowerCase();
      const itemCategory = div.dataset.category;
      const itemSubcategory = div.dataset.subcategory;

      const matchesSearch = name.includes(searchTerm) || description.includes(searchTerm);
      const matchesCategory = !category || itemCategory === category;
      const matchesSubcategory = !subcategory || itemSubcategory === subcategory;

      div.style.display = (matchesSearch && matchesCategory && matchesSubcategory) ? 'flex' : 'none';
    });
  }

  searchInput.addEventListener('input', filterItems);
  categorySelect.addEventListener('change', function() {
    const category = this.value;
    if (category && subcategories[category]) {
      subcategorySection.classList.remove('hidden');
      populateSubcategories(category);
    } else {
      subcategorySection.classList.add('hidden');
    }
    filterItems();
  });
  subcategorySelect.addEventListener('change', filterItems);

  function attachAddToCartListeners() {
    document.querySelectorAll('.add-to-cart-btn').forEach(button => {
      button.addEventListener('click', async () => {
        const itemId = button.getAttribute('data-id');
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Adding...';
        try {
          const response = await fetch('/shop/add-to-cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_id: itemId, quantity: 1 })
          });
          const result = await response.json();
          if (response.ok) {
            showToast('Item added to cart!', 'success');
            // Update cart count
            const cartCount = document.getElementById('cart-count');
            if (cartCount) {
              cartCount.textContent = parseInt(cartCount.textContent) + 1;
            }
          } else {
            showToast(result.error || 'Failed to add item', 'error');
          }
        } catch (error) {
          showToast('An error occurred', 'error');
        } finally {
          button.disabled = false;
          button.innerHTML = '<i class="fas fa-cart-plus mr-2"></i>Add to Cart';
        }
      });
    });
  }

  // Attach listeners initially
  attachAddToCartListeners();

  // Debug image src
  const firstImg = document.querySelector('#items-grid img');

  // Sidebar toggle
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  const mobileOverlay = document.getElementById('mobile-overlay');

  sidebarToggle.addEventListener('click', function() {
    sidebar.classList.toggle('-translate-x-full');
    mobileOverlay.classList.toggle('hidden');
  });

  mobileOverlay.addEventListener('click', function() {
    sidebar.classList.add('-translate-x-full');
    mobileOverlay.classList.add('hidden');
  });

  // Profile dropdown
  const profileToggle = document.getElementById('profile-toggle');
  const profileDropdown = document.getElementById('profile-dropdown');

  profileToggle.addEventListener('click', function() {
    profileDropdown.classList.toggle('hidden');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', function(e) {
    if (!profileToggle.contains(e.target) && !profileDropdown.contains(e.target)) {
      profileDropdown.classList.add('hidden');
    }
  });
});
