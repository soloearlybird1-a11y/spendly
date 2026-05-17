import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  Alert,
  Animated,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

// ─── Constants ───────────────────────────────────────────────
const COLORS = {
  bg: '#0F0F13',
  card: '#1A1A22',
  cardBorder: '#2A2A36',
  income: '#00E5A0',
  expense: '#FF5C7A',
  accent: '#7C6FFF',
  text: '#F0F0F5',
  subtext: '#7A7A95',
  input: '#22222E',
  white: '#FFFFFF',
};

const CATEGORIES = {
  income: [
    { icon: '💼', label: 'Salary' },
    { icon: '💡', label: 'Freelance' },
    { icon: '📈', label: 'Investment' },
    { icon: '🎁', label: 'Gift' },
    { icon: '💰', label: 'Other' },
  ],
  expense: [
    { icon: '🛒', label: 'Food' },
    { icon: '🚗', label: 'Transport' },
    { icon: '🏠', label: 'Housing' },
    { icon: '💊', label: 'Health' },
    { icon: '🎮', label: 'Fun' },
    { icon: '👕', label: 'Shopping' },
    { icon: '📱', label: 'Bills' },
    { icon: '📦', label: 'Other' },
  ],
};

const STORAGE_KEY = '@spendly_transactions';

// ─── Helpers ─────────────────────────────────────────────────
function formatMoney(amount) {
  return '$' + Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ─── Transaction Row ─────────────────────────────────────────
function TxRow({ item, onDelete }) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const handleDelete = () => {
    Alert.alert('Delete', 'Remove this transaction?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          Animated.parallel([
            Animated.timing(slideAnim, { toValue: -80, duration: 260, useNativeDriver: true }),
            Animated.timing(fadeAnim, { toValue: 0, duration: 260, useNativeDriver: true }),
          ]).start(() => onDelete(item.id));
        }
      }
    ]);
  };

  const isIncome = item.type === 'income';

  return (
    <Animated.View style={[styles.txRow, { transform: [{ translateX: slideAnim }], opacity: fadeAnim }]}>
      <View style={[styles.txIcon, { backgroundColor: isIncome ? '#00E5A015' : '#FF5C7A15' }]}>
        <Text style={styles.txEmoji}>{item.categoryIcon}</Text>
      </View>
      <View style={styles.txMeta}>
        <Text style={styles.txLabel} numberOfLines={1}>{item.description || item.categoryLabel}</Text>
        <Text style={styles.txDate}>{item.categoryLabel}  ·  {formatDate(item.date)}</Text>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: isIncome ? COLORS.income : COLORS.expense }]}>
          {isIncome ? '+' : '-'}{formatMoney(item.amount)}
        </Text>
        <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.txDelete}>✕</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ─── Balance Card ─────────────────────────────────────────────
function BalanceCard({ balance, totalIncome, totalExpense }) {
  const isPositive = balance >= 0;
  return (
    <View style={styles.balanceCard}>
      <View style={styles.balanceGlow} />
      <Text style={styles.balanceLabel}>TOTAL BALANCE</Text>
      <Text style={[styles.balanceAmount, { color: isPositive ? COLORS.income : COLORS.expense }]}>
        {isPositive ? '' : '-'}{formatMoney(balance)}
      </Text>
      <View style={styles.balanceRow}>
        <View style={styles.balanceStat}>
          <Text style={styles.balanceStatIcon}>↑</Text>
          <View>
            <Text style={styles.balanceStatLabel}>Income</Text>
            <Text style={[styles.balanceStatValue, { color: COLORS.income }]}>{formatMoney(totalIncome)}</Text>
          </View>
        </View>
        <View style={styles.balanceDivider} />
        <View style={styles.balanceStat}>
          <Text style={[styles.balanceStatIcon, { color: COLORS.expense }]}>↓</Text>
          <View>
            <Text style={styles.balanceStatLabel}>Expenses</Text>
            <Text style={[styles.balanceStatValue, { color: COLORS.expense }]}>{formatMoney(totalExpense)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Add Transaction Modal ────────────────────────────────────
function AddModal({ visible, onClose, onAdd }) {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCat, setSelectedCat] = useState(null);
  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      setType('expense');
      setAmount('');
      setDescription('');
      setSelectedCat(null);
      Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 600, duration: 250, useNativeDriver: true }).start();
    }
  }, [visible]);

  const cats = CATEGORIES[type];

  const handleSave = () => {
    const num = parseFloat(amount.replace(/[^0-9.]/g, ''));
    if (!num || num <= 0) { Alert.alert('Invalid', 'Enter a valid amount.'); return; }
    if (!selectedCat) { Alert.alert('Category', 'Please pick a category.'); return; }
    onAdd({
      id: uid(),
      type,
      amount: num,
      description: description.trim(),
      categoryIcon: cats[selectedCat].icon,
      categoryLabel: cats[selectedCat].label,
      date: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[styles.modalSheet, { transform: [{ translateY: slideAnim }] }]}>
          {/* Handle */}
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>New Transaction</Text>

          {/* Type Toggle */}
          <View style={styles.typeToggle}>
            {['expense', 'income'].map(t => (
              <TouchableOpacity
                key={t}
                onPress={() => { setType(t); setSelectedCat(null); }}
                style={[styles.typeBtn, type === t && {
                  backgroundColor: t === 'income' ? COLORS.income + '22' : COLORS.expense + '22',
                  borderColor: t === 'income' ? COLORS.income : COLORS.expense,
                }]}
              >
                <Text style={[styles.typeBtnText, type === t && {
                  color: t === 'income' ? COLORS.income : COLORS.expense,
                  fontWeight: '700',
                }]}>
                  {t === 'income' ? '↑ Income' : '↓ Expense'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Amount */}
          <View style={styles.amountContainer}>
            <Text style={styles.amountPrefix}>$</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor={COLORS.subtext}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              maxLength={10}
            />
          </View>

          {/* Description */}
          <TextInput
            style={styles.descInput}
            placeholder="Description (optional)"
            placeholderTextColor={COLORS.subtext}
            value={description}
            onChangeText={setDescription}
            maxLength={40}
          />

          {/* Categories */}
          <Text style={styles.catLabel}>CATEGORY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
            {cats.map((c, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setSelectedCat(i)}
                style={[styles.catChip, selectedCat === i && {
                  borderColor: type === 'income' ? COLORS.income : COLORS.expense,
                  backgroundColor: (type === 'income' ? COLORS.income : COLORS.expense) + '18',
                }]}
              >
                <Text style={styles.catChipIcon}>{c.icon}</Text>
                <Text style={[styles.catChipText, selectedCat === i && {
                  color: type === 'income' ? COLORS.income : COLORS.expense,
                }]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, {
              backgroundColor: type === 'income' ? COLORS.income : COLORS.expense,
            }]}
            onPress={handleSave}
            activeOpacity={0.85}
          >
            <Text style={styles.saveBtnText}>Save Transaction</Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main App ─────────────────────────────────────────────────
export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [filter, setFilter] = useState('all'); // all | income | expense
  const fabAnim = useRef(new Animated.Value(0)).current;

  // Load from storage
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) setTransactions(JSON.parse(raw));
    });
    Animated.spring(fabAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
  }, []);

  // Save to storage
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  }, [transactions]);

  const addTransaction = (tx) => setTransactions(prev => [tx, ...prev]);
  const deleteTransaction = (id) => setTransactions(prev => prev.filter(t => t.id !== id));

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const filtered = filter === 'all' ? transactions
    : transactions.filter(t => t.type === filter);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Spendly</Text>
        <Text style={styles.headerSub}>💸 your pocket tracker</Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16 }}
        ListHeaderComponent={
          <>
            <BalanceCard balance={balance} totalIncome={totalIncome} totalExpense={totalExpense} />

            {/* Filter Tabs */}
            <View style={styles.filterRow}>
              {['all', 'income', 'expense'].map(f => (
                <TouchableOpacity
                  key={f}
                  onPress={() => setFilter(f)}
                  style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
                >
                  <Text style={[styles.filterBtnText, filter === f && styles.filterBtnTextActive]}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {filtered.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>💳</Text>
                <Text style={styles.emptyText}>No transactions yet</Text>
                <Text style={styles.emptySub}>Tap + to add your first one</Text>
              </View>
            )}
          </>
        }
        renderItem={({ item }) => (
          <TxRow item={item} onDelete={deleteTransaction} />
        )}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <Animated.View style={[styles.fab, {
        transform: [{ scale: fabAnim }],
      }]}>
        <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.fabBtn} activeOpacity={0.85}>
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      </Animated.View>

      <AddModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onAdd={addTransaction}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 42,
    paddingBottom: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    color: COLORS.subtext,
  },

  // Balance Card
  balanceCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
  },
  balanceGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: COLORS.accent + '18',
  },
  balanceLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: COLORS.subtext,
    marginBottom: 6,
  },
  balanceAmount: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1.5,
    marginBottom: 20,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  balanceStatIcon: {
    fontSize: 20,
    color: COLORS.income,
    fontWeight: '700',
  },
  balanceStatLabel: {
    fontSize: 11,
    color: COLORS.subtext,
    marginBottom: 2,
  },
  balanceStatValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  balanceDivider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.cardBorder,
    marginHorizontal: 16,
  },

  // Filter
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  filterBtnActive: {
    backgroundColor: COLORS.accent + '22',
    borderColor: COLORS.accent,
  },
  filterBtnText: {
    fontSize: 13,
    color: COLORS.subtext,
    fontWeight: '600',
  },
  filterBtnTextActive: {
    color: COLORS.accent,
  },

  // Transaction Row
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    gap: 12,
  },
  txIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txEmoji: {
    fontSize: 20,
  },
  txMeta: {
    flex: 1,
  },
  txLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  txDate: {
    fontSize: 11,
    color: COLORS.subtext,
  },
  txRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  txDelete: {
    fontSize: 12,
    color: COLORS.subtext,
    paddingHorizontal: 2,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyText: { fontSize: 17, fontWeight: '700', color: COLORS.subtext, marginBottom: 4 },
  emptySub: { fontSize: 13, color: COLORS.subtext + '99' },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 36,
    alignSelf: 'center',
  },
  fabBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  fabIcon: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '300',
    marginTop: -2,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: COLORS.cardBorder,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.cardBorder,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 20,
    letterSpacing: -0.5,
  },

  // Type Toggle
  typeToggle: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    backgroundColor: 'transparent',
  },
  typeBtnText: {
    fontSize: 14,
    color: COLORS.subtext,
    fontWeight: '600',
  },

  // Amount
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.input,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  amountPrefix: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.subtext,
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    paddingVertical: 14,
  },
  descInput: {
    backgroundColor: COLORS.input,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },

  // Categories
  catLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: COLORS.subtext,
    marginBottom: 10,
  },
  catScroll: {
    marginBottom: 24,
    marginHorizontal: -4,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.input,
    marginHorizontal: 4,
  },
  catChipIcon: { fontSize: 16 },
  catChipText: {
    fontSize: 13,
    color: COLORS.subtext,
    fontWeight: '600',
  },

  // Save Button
  saveBtn: {
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 0.3,
  },
});