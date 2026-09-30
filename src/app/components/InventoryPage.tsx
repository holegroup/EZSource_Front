import { AppHeader } from './AppHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { StatusBadge, StockStatus } from './StatusBadge';
import { Textarea } from './ui/textarea';
import { Search, Edit, TrendingDown, TrendingUp, Package, Loader2, Mail, LayoutGrid, Rows3, Table2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Label } from './ui/label';

type StockLayout = 'table' | 'cards' | 'compact';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  sku: string;
  stock: number;
  minStock: number;
  unit: string;
  status: StockStatus;
  lastRestocked: string;
}

interface InventoryPageProps {
  onMenuClick?: () => void;
}

const LAYOUT_STORAGE_KEY = 'printflow-stock-layout';
const ADMIN_ROLES = ['super_user', 'inventory_admin'];

const readStoredLayout = (): StockLayout => {
  const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
  if (saved === 'cards' || saved === 'compact' || saved === 'table') return saved;
  return 'table';
};

const mapInventoryItem = (item: any): InventoryItem => {
  const prod = item.product || {};
  const stock = Number(item.quantityAvailable || 0);
  const minStock = Number(item.reorderPoint || 0);
  let status: StockStatus = 'in-stock';
  if (stock === 0) status = 'out-of-stock';
  else if (stock <= minStock) status = 'low-stock';

  return {
    id: item._id,
    name: prod.name || 'Unknown Product',
    category: prod.category || 'General',
    sku: prod.sku || 'N/A',
    stock,
    minStock,
    unit: 'units',
    status,
    lastRestocked: item.lastStockedAt ? String(item.lastStockedAt).slice(0, 10) : 'N/A',
  };
};

const layoutOptions: { id: StockLayout; label: string; hint: string; icon: typeof Table2 }[] = [
  { id: 'table', label: 'Table', hint: 'Full columns', icon: Table2 },
  { id: 'cards', label: 'Cards', hint: 'Grid of items', icon: LayoutGrid },
  { id: 'compact', label: 'Compact', hint: 'Dense list', icon: Rows3 },
];

export function InventoryPage({ onMenuClick }: InventoryPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManageStock, setCanManageStock] = useState(false);
  const [layout, setLayout] = useState<StockLayout>(readStoredLayout);

  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [increaseAmount, setIncreaseAmount] = useState('1');
  const [decreaseAmount, setDecreaseAmount] = useState('1');
  const [orderQuantity, setOrderQuantity] = useState('1');
  const [orderNote, setOrderNote] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [busyAction, setBusyAction] = useState<'increase' | 'decrease' | 'order' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/inventory', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.success && data.data) {
        setInventory(data.data.map(mapInventoryItem));
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const role = localStorage.getItem('userRole') || '';
    setCanManageStock(ADMIN_ROLES.includes(role));
    fetchInventory();
  }, []);

  const applyUpdatedItem = (raw: any) => {
    const mapped = mapInventoryItem(raw);
    setInventory((current) => current.map((item) => (item.id === mapped.id ? mapped : item)));
    setEditingItem((current) => (current && current.id === mapped.id ? mapped : current));
  };

  const handleEditClick = (item: InventoryItem) => {
    const suggestedOrder = Math.max(item.minStock - item.stock, item.minStock, 1);
    setEditingItem(item);
    setIncreaseAmount('1');
    setDecreaseAmount('1');
    setOrderQuantity(String(suggestedOrder));
    setOrderNote('');
    setRecipientEmail('');
    setFeedback(null);
  };

  const postStockAction = async (
    path: string,
    body: Record<string, unknown>,
    action: 'increase' | 'decrease' | 'order'
  ) => {
    if (!editingItem) return;
    setBusyAction(action);
    setFeedback(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ inventoryId: editingItem.id, ...body })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        if (data.data) applyUpdatedItem(data.data);
        setFeedback({ type: 'success', text: data.message || 'Stock updated.' });
      } else {
        setFeedback({ type: 'error', text: data.error || 'Request failed.' });
      }
    } catch (err) {
      console.error(`Error calling ${path}:`, err);
      setFeedback({ type: 'error', text: 'Could not reach the server.' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleIncrease = () => {
    postStockAction('/api/v1/inventory/increase-stock', { amount: Number(increaseAmount) }, 'increase');
  };

  const handleDecrease = () => {
    postStockAction('/api/v1/inventory/decrease-stock', { amount: Number(decreaseAmount) }, 'decrease');
  };

  const handleOrderEmail = () => {
    postStockAction('/api/v1/inventory/order-stock', {
      quantity: Number(orderQuantity),
      note: orderNote,
      recipientEmail,
    }, 'order');
  };

  const handleLayoutChange = (next: StockLayout) => {
    setLayout(next);
    localStorage.setItem(LAYOUT_STORAGE_KEY, next);
    setFeedback({ type: 'success', text: `Stock layout changed to ${next}.` });
  };

  const filteredInventory = inventory.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: inventory.length,
    inStock: inventory.filter(i => i.status === 'in-stock').length,
    lowStock: inventory.filter(i => i.status === 'low-stock').length,
    outOfStock: inventory.filter(i => i.status === 'out-of-stock').length,
  };

  const layoutLabel = layoutOptions.find((option) => option.id === layout)?.label || 'Table';

  const renderActions = (item: InventoryItem) => {
    if (!canManageStock) return null;
    return (
      <Button variant="ghost" size="sm" className="gap-2" onClick={() => handleEditClick(item)}>
        <Edit className="h-4 w-4" />
        Edit
      </Button>
    );
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden relative">
      <AppHeader onMenuClick={onMenuClick} />
      
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Inventory Management</h1>
              <p className="text-muted-foreground">Manage your printing materials and supplies</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Items</p>
                    <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">In Stock</p>
                    <p className="text-2xl font-bold text-success">{stats.inStock}</p>
                  </div>
                  <div className="p-3 bg-success/10 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Low Stock</p>
                    <p className="text-2xl font-bold text-warning">{stats.lowStock}</p>
                  </div>
                  <div className="p-3 bg-warning/10 rounded-lg">
                    <TrendingDown className="h-5 w-5 text-warning" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Out of Stock</p>
                    <p className="text-2xl font-bold text-destructive">{stats.outOfStock}</p>
                  </div>
                  <div className="p-3 bg-destructive/10 rounded-lg">
                    <Package className="h-5 w-5 text-destructive" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Inventory Items</CardTitle>
                  <CardDescription>
                    {canManageStock
                      ? `Manage stock levels and materials. Layout: ${layoutLabel}. Use Edit to change it.`
                      : 'Manage stock levels and materials'}
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-[300px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search inventory..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-input-background"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : layout === 'cards' ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredInventory.map((item) => (
                    <div key={item.id} className="rounded-lg border border-border p-4 space-y-3 bg-card">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">{item.sku}</p>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <p className="text-2xl font-bold text-foreground">{item.stock.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Min {item.minStock.toLocaleString()} · {item.category}</p>
                        </div>
                        {renderActions(item)}
                      </div>
                      <p className="text-xs text-muted-foreground">Restocked {item.lastRestocked}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">Item Name</TableHead>
                        {layout === 'table' && <TableHead className="font-semibold">SKU</TableHead>}
                        {layout === 'table' && <TableHead className="font-semibold">Category</TableHead>}
                        <TableHead className="font-semibold">Stock</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        {layout === 'table' && <TableHead className="font-semibold">Last Restocked</TableHead>}
                        {canManageStock && <TableHead className="font-semibold text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInventory.map((item) => (
                        <TableRow key={item.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium">
                            <div>
                              {item.name}
                              {layout === 'compact' && (
                                <p className="text-xs text-muted-foreground">{item.sku} · {item.category}</p>
                              )}
                            </div>
                          </TableCell>
                          {layout === 'table' && (
                            <TableCell>
                              <code className="text-xs bg-muted px-2 py-1 rounded">{item.sku}</code>
                            </TableCell>
                          )}
                          {layout === 'table' && (
                            <TableCell>
                              <Badge variant="outline">{item.category}</Badge>
                            </TableCell>
                          )}
                          <TableCell>
                            <div>
                              <p className="font-medium text-foreground">
                                {item.stock.toLocaleString()} {item.unit}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Min: {item.minStock.toLocaleString()}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={item.status} />
                          </TableCell>
                          {layout === 'table' && (
                            <TableCell className="text-muted-foreground text-sm">
                              {item.lastRestocked}
                            </TableCell>
                          )}
                          {canManageStock && (
                            <TableCell className="text-right">
                              {renderActions(item)}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {!loading && filteredInventory.length === 0 && (
                <div className="py-12 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold text-lg text-foreground mb-2">No items found</h3>
                  <p className="text-sm text-muted-foreground">
                    Try adjusting your search query
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg shadow-2xl border-border bg-background max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Edit className="h-5 w-5 text-emerald-500" />
                Edit {editingItem.name}
              </CardTitle>
              <CardDescription>
                {editingItem.stock.toLocaleString()} {editingItem.unit} on hand · minimum {editingItem.minStock.toLocaleString()} · {editingItem.sku}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {feedback && (
                <p className={`text-sm rounded-md px-3 py-2 ${feedback.type === 'success' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-destructive/10 text-destructive'}`}>
                  {feedback.text}
                </p>
              )}

              <div className="space-y-2">
                <Label htmlFor="increaseAmount">Increase stock</Label>
                <div className="flex gap-2">
                  <Input
                    id="increaseAmount"
                    type="number"
                    min="1"
                    step="1"
                    value={increaseAmount}
                    onChange={(e) => setIncreaseAmount(e.target.value)}
                  />
                  <Button type="button" onClick={handleIncrease} disabled={busyAction !== null} className="shrink-0">
                    {busyAction === 'increase' ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4 mr-2" />}
                    Increase
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="decreaseAmount">Decrease stock</Label>
                <div className="flex gap-2">
                  <Input
                    id="decreaseAmount"
                    type="number"
                    min="1"
                    step="1"
                    value={decreaseAmount}
                    onChange={(e) => setDecreaseAmount(e.target.value)}
                  />
                  <Button type="button" variant="outline" onClick={handleDecrease} disabled={busyAction !== null} className="shrink-0">
                    {busyAction === 'decrease' ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingDown className="h-4 w-4 mr-2" />}
                    Decrease
                  </Button>
                </div>
              </div>

              <div className="space-y-3 border-t pt-4">
                <Label htmlFor="orderQuantity">Order stock by email</Label>
                <Input
                  id="orderQuantity"
                  type="number"
                  min="1"
                  step="1"
                  value={orderQuantity}
                  onChange={(e) => setOrderQuantity(e.target.value)}
                />
                <div className="space-y-2">
                  <Label htmlFor="recipientEmail">Extra recipient (optional)</Label>
                  <Input
                    id="recipientEmail"
                    type="email"
                    placeholder="supplier@example.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                  />
                </div>
                <Textarea
                  id="orderNote"
                  placeholder="Note for the order, such as paper type or delivery date"
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                />
                <Button type="button" variant="outline" onClick={handleOrderEmail} disabled={busyAction !== null} className="w-full">
                  {busyAction === 'order' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                  Send order email
                </Button>
              </div>

              <div className="space-y-2 border-t pt-4">
                <Label>Stock layout</Label>
                <div className="grid grid-cols-3 gap-2">
                  {layoutOptions.map((option) => {
                    const Icon = option.icon;
                    const selected = layout === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleLayoutChange(option.id)}
                        className={`rounded-lg border px-2 py-3 text-left transition-colors ${selected ? 'border-emerald-500 bg-emerald-500/10' : 'border-border hover:bg-muted/60'}`}
                      >
                        <Icon className={`h-4 w-4 mb-2 ${selected ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                        <p className="text-sm font-medium">{option.label}</p>
                        <p className="text-xs text-muted-foreground">{option.hint}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setEditingItem(null)}>
                Close
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
