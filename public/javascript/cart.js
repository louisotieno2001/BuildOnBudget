
function updateTotal() {
    const cartItems = document.querySelectorAll('.cart-item');
    let total = 0;
    cartItems.forEach(itemDiv => {
        const totalSpan = itemDiv.querySelector('.item-total');
        const totalText = totalSpan.textContent.replace('$', '');
        total += parseFloat(totalText) || 0;
    });
    document.getElementById('overall-total').textContent = `Total: $${total.toFixed(2)}`;
}

// Update quantity
document.querySelectorAll('.quantity-input').forEach(input => {
    input.addEventListener('change', async () => {
        const orderId = input.getAttribute('data-id');
        const quantity = parseInt(input.value);
        if (quantity < 1) return;
        try {
            const response = await fetch('/cart/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId, quantity })
            });
            if (response.ok) {
                // Update the item total
                const itemDiv = input.closest('.cart-item');
                const priceText = itemDiv.querySelector('.item-price').textContent.replace('$', '').replace(' each', '');
                const price = parseFloat(priceText);
                const newTotal = price * quantity;
                itemDiv.querySelector('.item-total').textContent = `$${newTotal.toFixed(2)}`;
                updateTotal();
            } else {
                showToast('Failed to update quantity', 'error');
            }
        } catch (error) {
            showToast('An error occurred', 'error');
        }
    });
});

// Remove item
document.querySelectorAll('.remove-btn').forEach(button => {
    button.addEventListener('click', async () => {
        const orderId = button.getAttribute('data-id');
        try {
            const response = await fetch('/cart/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId, quantity: 0 })
            });
            if (response.ok) {
                const itemDiv = button.closest('.cart-item');
                itemDiv.remove();
                updateTotal();
            } else {
                showToast('Failed to remove item', 'error');
            }
        } catch (error) {
            showToast('An error occurred', 'error');
        }
    });
});

// Checkout
document.getElementById('checkout-btn')?.addEventListener('click', async () => {
    const button = document.getElementById('checkout-btn');
    button.disabled = true;
    button.textContent = 'Processing...';
    try {
        const response = await fetch('/cart/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();
        if (response.ok) {
            showToast('Order placed successfully', 'success');
            setTimeout(() => location.href = '/dashboard', 1000);
        } else {
            showToast(result.error || 'Failed to place order', 'error');
            button.disabled = false;
            button.textContent = 'Checkout';
        }
    } catch (error) {
        showToast('An error occurred', 'error');
        button.disabled = false;
        button.textContent = 'Checkout';
    }
});
