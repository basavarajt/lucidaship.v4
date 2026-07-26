import React, { useState, useEffect } from 'react';
import { Search, UserPlus, UserMinus, UserCheck, AlertCircle } from 'lucide-react';
import { getAuth } from 'firebase/auth';

export default function ContactManager() {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    fetchContacts();
  }, []);

  const getHeaders = async () => {
    const auth = getAuth();
    const token = await auth.currentUser?.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${apiUrl}/api/admin/contacts`, { headers });
      if (!res.ok) throw new Error('Failed to fetch contacts');
      const data = await res.json();
      setContacts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addContact = async () => {
    const email = prompt('Contact Email?');
    if (!email) return;
    const firstName = prompt('First Name?');
    const lastName = prompt('Last Name?');

    try {
      const headers = await getHeaders();
      const res = await fetch(`${apiUrl}/api/admin/contacts/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, first_name: firstName, last_name: lastName })
      });
      if (!res.ok) throw new Error('Failed to add contact');
      await fetchContacts();
    } catch (err) {
      alert(err.message);
    }
  };

  const updateContact = async (id, unsubscribed) => {
    try {
      const headers = await getHeaders();
      const res = await fetch(`${apiUrl}/api/admin/contacts/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ unsubscribed })
      });
      if (!res.ok) throw new Error('Failed to update contact');
      await fetchContacts();
    } catch (err) {
      alert(err.message);
    }
  };

  const removeContact = async (id) => {
    if (!window.confirm("Are you sure you want to delete this contact?")) return;
    try {
      const headers = await getHeaders();
      const res = await fetch(`${apiUrl}/api/admin/contacts/${id}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error('Failed to delete contact');
      await fetchContacts();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-serif text-white">Contacts ({contacts.length})</h2>
        <button 
          onClick={addContact}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" /> Add Contact
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2 mb-6 text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-black border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-blue-500/50"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-400">
          <thead className="bg-black text-gray-300 text-xs uppercase font-mono border-b border-white/10">
            <tr>
              <th className="px-6 py-4 font-medium">Email</th>
              <th className="px-6 py-4 font-medium">Name</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && contacts.length === 0 ? (
              <tr><td colSpan="4" className="text-center py-8">Loading...</td></tr>
            ) : contacts.filter(c => c.email.toLowerCase().includes(search.toLowerCase())).length === 0 ? (
              <tr><td colSpan="4" className="text-center py-8">No contacts found.</td></tr>
            ) : (
              contacts.filter(c => c.email.toLowerCase().includes(search.toLowerCase())).map(contact => (
                <tr key={contact.id} className="hover:bg-white/[0.02]">
                  <td className="px-6 py-4 text-white">{contact.email}</td>
                  <td className="px-6 py-4">{contact.first_name || '-'} {contact.last_name || ''}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${contact.unsubscribed ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                      {contact.unsubscribed ? 'Unsubscribed' : 'Active'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => updateContact(contact.id, !contact.unsubscribed)}
                      className="text-gray-400 hover:text-white mr-3 transition-colors"
                      title={contact.unsubscribed ? "Resubscribe" : "Unsubscribe"}
                    >
                      {contact.unsubscribed ? <UserCheck className="w-4 h-4" /> : <UserMinus className="w-4 h-4" />}
                    </button>
                    <button 
                      onClick={() => removeContact(contact.id)}
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
